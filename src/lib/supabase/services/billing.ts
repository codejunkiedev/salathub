import { SupabaseTables, type MasjidBilling, type PlanRules } from '@/types';
import supabase from '../index';
import { getMasjidMembership } from '../helpers';
import { captureSupabaseError } from '@/lib/sentry';

/** Null for a moderator, who can't read billing. */
export async function getMasjidBilling(): Promise<MasjidBilling | null> {
  const { masjid_id } = await getMasjidMembership();

  const { data, error } = await supabase
    .from(SupabaseTables.MasjidBilling)
    .select(
      'masjid_id, plan, status, currency, extra_screens, trial_ends_at, renews_at, grace_ends_at, stripe_customer_id'
    )
    .eq('masjid_id', masjid_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getPlanRules(): Promise<PlanRules[]> {
  const { data, error } = await supabase.from(SupabaseTables.PlanRules).select('*');
  if (error) throw error;
  return data ?? [];
}

export async function countMasjidScreens(): Promise<number> {
  const { masjid_id } = await getMasjidMembership();

  const { count, error } = await supabase
    .from(SupabaseTables.DisplayScreens)
    .select('id', { count: 'exact', head: true })
    .eq('masjid_id', masjid_id);

  if (error) throw error;
  return count ?? 0;
}

/** Stripe checkout for an upgrade, or the billing portal to manage a subscription. */
export async function getBillingUrl(action: 'checkout' | 'portal'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('billing', { body: { action } });

  if (error) {
    captureSupabaseError(error, { source: 'supabase.functions', operation: `billing_${action}` });
    if ('context' in error && error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw new Error(action === 'checkout' ? 'Could not start checkout' : 'Could not open billing');
  }
  if (!data?.url) throw new Error(data?.error ?? 'No billing link returned');
  return data.url;
}
