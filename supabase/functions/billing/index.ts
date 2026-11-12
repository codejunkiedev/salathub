/**
 * Starts Stripe checkout or opens the billing portal for the caller's masjid.
 *
 *   POST /billing  { action: 'checkout' | 'portal' }
 *   header: Authorization: Bearer <masjid admin's access token>
 *   → { url }
 *
 * Only the masjid's admin can call it, and only for their own masjid. Checkout
 * charges in the masjid's currency, with the screen count adjustable from the
 * 5 included upwards.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getStripe, PRO_PRICE_LOOKUP_KEY } from '../_shared/stripe.ts';

const MAX_SCREENS = 99;
const BILLING_PATH = '/admin/settings/billing';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, baggage, sentry-trace',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const {
    data: { user: caller },
  } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!caller) return json({ error: 'Invalid token' }, 401);

  const { data: membership } = await admin
    .from('masjid_members')
    .select('masjid_id, role')
    .eq('user_id', caller.id)
    .maybeSingle();
  if (!membership || membership.role !== 'admin') return json({ error: 'Not allowed' }, 403);
  const masjidId: string = membership.masjid_id;

  let payload: { action?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (payload.action !== 'checkout' && payload.action !== 'portal') {
    return json({ error: 'Unknown action' }, 400);
  }

  const consoleUrl = Deno.env.get('CONSOLE_URL');
  if (!consoleUrl) throw new Error('CONSOLE_URL must be set');
  const returnUrl = consoleUrl + BILLING_PATH;

  const { data: billing, error: billingError } = await admin
    .from('masjid_billing')
    .select('plan, status, currency, stripe_customer_id')
    .eq('masjid_id', masjidId)
    .single();
  if (billingError) throw billingError;

  const stripe = getStripe();

  if (payload.action === 'portal') {
    if (!billing.stripe_customer_id) return json({ error: 'No billing account yet' }, 409);
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: returnUrl,
    });
    return json({ url: session.url });
  }

  if (['active', 'cancelled', 'payment_failed'].includes(billing.status)) {
    return json({ error: 'This masjid already has a subscription. Use Manage instead.' }, 409);
  }

  const [{ data: profile }, { data: rules }, { count: screenCount }] = await Promise.all([
    admin.from('masjid_profiles').select('name').eq('id', masjidId).single(),
    admin.from('plan_rules').select('included_screens').eq('plan', 'pro').single(),
    admin
      .from('display_screens')
      .select('id', { count: 'exact', head: true })
      .eq('masjid_id', masjidId),
  ]);
  if (!profile || !rules) throw new Error('Masjid profile or plan rules missing');

  let customerId: string | null = billing.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: profile.name,
      email: caller.email,
      metadata: { masjid_id: masjidId },
    });
    const { data: claimed } = await admin
      .from('masjid_billing')
      .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
      .eq('masjid_id', masjidId)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .maybeSingle();
    if (claimed) {
      customerId = customer.id;
    } else {
      // Another request created one first; use theirs.
      await stripe.customers.del(customer.id);
      const { data: existing } = await admin
        .from('masjid_billing')
        .select('stripe_customer_id')
        .eq('masjid_id', masjidId)
        .single();
      customerId = existing?.stripe_customer_id ?? null;
    }
  }
  if (!customerId) throw new Error('Could not set up a billing account');

  const { data: prices } = await stripe.prices.list({
    lookup_keys: [PRO_PRICE_LOOKUP_KEY],
    active: true,
    limit: 1,
  });
  const price = prices[0];
  if (!price) throw new Error(`No active price with lookup key ${PRO_PRICE_LOOKUP_KEY}`);

  const included: number = rules.included_screens;
  const quantity = Math.min(Math.max(included, screenCount ?? 0), MAX_SCREENS);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    currency: billing.currency,
    client_reference_id: masjidId,
    line_items: [
      {
        price: price.id,
        quantity,
        adjustable_quantity: { enabled: true, minimum: included, maximum: MAX_SCREENS },
      },
    ],
    subscription_data: { metadata: { masjid_id: masjidId } },
    metadata: { masjid_id: masjidId },
    // We sell and collect tax ourselves (PB-94), so not through Stripe Managed Payments,
    // which the account has on by default and which rejects custom_text.
    managed_payments: { enabled: false },
    consent_collection: { terms_of_service: 'required' },
    custom_text: {
      terms_of_service_acceptance: {
        message: `I agree to the [Terms](${consoleUrl}/terms) and [Refund Policy](${consoleUrl}/refund-policy).`,
      },
      submit: {
        message:
          'SalatHub Pro renews automatically every year at the then-current price until you cancel. You can cancel at any time from the Billing page of the console.',
      },
    },
    success_url: `${returnUrl}?checkout=success`,
    cancel_url: returnUrl,
  });

  return json({ url: session.url });
});
