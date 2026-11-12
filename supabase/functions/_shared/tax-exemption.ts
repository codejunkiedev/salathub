/**
 * Keeps a masjid's Stripe customer tax exempt exactly while an approved,
 * unexpired certificate covers the US state of its billing address. Stripe's
 * exemption is per customer, not per state, hence the check here. With no
 * address yet (before the first checkout), any approved certificate counts.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Stripe } from './stripe.ts';

const TAX_STATUS_FIELD = 'Tax status';

export const syncTaxExemption = async (
  admin: SupabaseClient,
  stripe: Stripe,
  masjidId: string,
  customerId?: string | null
): Promise<'exempt' | 'none' | 'no_customer'> => {
  let customer = customerId ?? null;
  if (!customer) {
    const { data, error } = await admin
      .from('masjid_billing')
      .select('stripe_customer_id')
      .eq('masjid_id', masjidId)
      .maybeSingle();
    if (error) throw error;
    customer = data?.stripe_customer_id ?? null;
  }
  if (!customer) return 'no_customer';

  const [current, certificates] = await Promise.all([
    stripe.customers.retrieve(customer),
    admin
      .from('tax_exemption_certificates')
      .select('state, expires_at')
      .eq('masjid_id', masjidId)
      .eq('status', 'approved'),
  ]);
  if (certificates.error) throw certificates.error;
  if (current.deleted) return 'no_customer';

  const address = current.address;
  const state = address?.country === 'US' ? address.state?.toUpperCase() : null;
  const now = Date.now();
  const covering = (certificates.data ?? []).find(
    cert =>
      (!cert.expires_at || new Date(cert.expires_at).getTime() > now) &&
      (address?.country ? cert.state === state : true)
  );

  const exempt = !!covering;
  const wantedValue = covering ? `Tax exempt (${covering.state} certificate)` : null;
  const currentValue =
    (current.invoice_settings?.custom_fields ?? []).find(f => f.name === TAX_STATUS_FIELD)?.value ??
    null;

  if (current.tax_exempt !== (exempt ? 'exempt' : 'none') || currentValue !== wantedValue) {
    await stripe.customers.update(customer, {
      tax_exempt: exempt ? 'exempt' : 'none',
      invoice_settings: {
        custom_fields: wantedValue ? [{ name: TAX_STATUS_FIELD, value: wantedValue }] : '',
      },
    });
  }
  return exempt ? 'exempt' : 'none';
};
