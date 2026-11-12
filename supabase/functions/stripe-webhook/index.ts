/**
 * Keeps masjid_billing in step with Stripe.
 *
 *   POST /stripe-webhook   (called by Stripe, signed with STRIPE_WEBHOOK_SECRET)
 *
 * Every handled event leads back to a subscription, which is fetched fresh from
 * Stripe and written to the masjid named in its metadata. Events can arrive
 * late or out of order, so the event's own copy is never trusted. A redelivered
 * event is skipped through stripe_events.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { billingFromSubscription, getStripe, Stripe } from '../_shared/stripe.ts';

const HANDLED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]);

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  !value ? null : typeof value === 'string' ? value : value.id;

const subscriptionIdOf = (event: Stripe.Event): string | null => {
  const object = event.data.object as unknown as Record<string, unknown>;
  switch (event.type) {
    case 'checkout.session.completed':
      return idOf((object as unknown as Stripe.Checkout.Session).subscription);
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = object as unknown as Stripe.Invoice;
      return idOf(invoice.parent?.subscription_details?.subscription);
    }
    default:
      return (object as unknown as Stripe.Subscription).id;
  }
};

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('Stripe-Signature');
  if (!secret || !signature) return new Response('Missing signature', { status: 400 });

  const stripe = getStripe();
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  if (!HANDLED.has(event.type)) return new Response('ignored');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: seen } = await admin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (seen) return new Response('duplicate');

  const subscriptionId = subscriptionIdOf(event);
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice'],
    });
    const masjidId = subscription.metadata?.masjid_id;
    if (!masjidId) {
      console.warn(`Subscription ${subscription.id} has no masjid_id; ignored`);
    } else {
      await applySubscription(admin, masjidId, subscription);
    }
  }

  const { error } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (error && error.code !== '23505') throw error;

  return new Response('ok');
});

async function applySubscription(
  admin: SupabaseClient,
  masjidId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const { data: current, error: readError } = await admin
    .from('masjid_billing')
    .select('stripe_subscription_id')
    .eq('masjid_id', masjidId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) {
    console.warn(`No billing row for masjid ${masjidId}; ignored`);
    return;
  }

  const { data: rules, error: rulesError } = await admin
    .from('plan_rules')
    .select('included_screens')
    .eq('plan', 'pro')
    .single();
  if (rulesError) throw rulesError;

  const update = billingFromSubscription(subscription, rules.included_screens);
  if (!update) return;

  // An ended subscription mustn't overwrite a newer one the masjid has since started.
  const isCurrent =
    !current.stripe_subscription_id || current.stripe_subscription_id === subscription.id;
  if (!isCurrent && update.plan === 'free') return;

  const { error } = await admin
    .from('masjid_billing')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('masjid_id', masjidId);
  if (error) throw error;
}
