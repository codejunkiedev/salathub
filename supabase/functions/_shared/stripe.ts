/**
 * Stripe client and the mapping from a Stripe subscription to a masjid_billing
 * row. Needs STRIPE_SECRET_KEY.
 */
import Stripe from 'npm:stripe@23.1.0';

export { Stripe };

export const PRO_PRICE_LOOKUP_KEY = 'salathub_pro_yearly';
export const GRACE_DAYS = 14;

export const getStripe = (): Stripe => {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY must be set');
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
};

export type BillingUpdate = {
  plan: 'free' | 'pro';
  status: 'none' | 'active' | 'payment_failed' | 'cancelled';
  extra_screens: number;
  renews_at: string | null;
  grace_ends_at: string | null;
  currency: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
};

const iso = (seconds: number | null | undefined): string | null =>
  seconds ? new Date(seconds * 1000).toISOString() : null;

/**
 * What the masjid's row should say for this subscription, or null when the
 * subscription doesn't change it yet (checkout started but not paid).
 * Grace runs from when the unpaid invoice was finalized, so it can't restart.
 */
export const billingFromSubscription = (
  subscription: Stripe.Subscription,
  includedScreens: number,
  now = new Date()
): BillingUpdate | null => {
  const item = subscription.items.data[0];
  const customer =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const base = {
    currency: subscription.currency,
    stripe_customer_id: customer,
    extra_screens: Math.max((item?.quantity ?? 0) - includedScreens, 0),
    renews_at: iso(item?.current_period_end),
  };

  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return {
        ...base,
        plan: 'pro',
        status:
          subscription.cancel_at_period_end || subscription.cancel_at ? 'cancelled' : 'active',
        grace_ends_at: null,
        stripe_subscription_id: subscription.id,
      };
    case 'past_due':
    case 'unpaid': {
      const invoice =
        typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null;
      const failedAt = invoice?.status_transitions?.finalized_at ?? invoice?.created;
      const graceEnds = new Date(
        (failedAt ? failedAt * 1000 : now.getTime()) + GRACE_DAYS * 24 * 60 * 60 * 1000
      );
      if (graceEnds <= now) {
        return {
          ...base,
          plan: 'free',
          status: 'none',
          grace_ends_at: null,
          stripe_subscription_id: subscription.id,
        };
      }
      return {
        ...base,
        plan: 'pro',
        status: 'payment_failed',
        grace_ends_at: graceEnds.toISOString(),
        stripe_subscription_id: subscription.id,
      };
    }
    case 'canceled':
    case 'incomplete_expired':
      return {
        ...base,
        plan: 'free',
        status: 'none',
        extra_screens: 0,
        renews_at: null,
        grace_ends_at: null,
        stripe_subscription_id: null,
      };
    default:
      return null;
  }
};
