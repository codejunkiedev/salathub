import {
  SupabaseBuckets,
  SupabaseTables,
  type MasjidBilling,
  type PlanRules,
  type TaxExemptionCertificate,
} from '@/types';
import supabase from '../index';
import { getMasjidMembership, getSessionUser } from '../helpers';
import { captureSupabaseError } from '@/lib/sentry';

/** Null for a moderator, who can't read billing. */
export async function getMasjidBilling(): Promise<MasjidBilling | null> {
  const { masjid_id } = await getMasjidMembership();

  const { data, error } = await supabase
    .from(SupabaseTables.MasjidBilling)
    .select(
      'masjid_id, plan, status, currency, extra_screens, trial_ends_at, renews_at, grace_ends_at, granted_until, stripe_customer_id'
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

export const TAX_EXEMPTION_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const TAX_EXEMPTION_MAX_FILE_SIZE = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Newest first. Admins only; empty for anyone else. */
export async function getTaxExemptionCertificates(): Promise<TaxExemptionCertificate[]> {
  const { masjid_id } = await getMasjidMembership();

  const { data, error } = await supabase
    .from(SupabaseTables.TaxExemptionCertificates)
    .select('*')
    .eq('masjid_id', masjid_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function uploadTaxExemptionCertificate(
  state: string,
  file: File
): Promise<TaxExemptionCertificate> {
  if (!TAX_EXEMPTION_FILE_TYPES.includes(file.type)) {
    throw new Error('Upload a PDF, JPG or PNG file');
  }
  if (file.size > TAX_EXEMPTION_MAX_FILE_SIZE) {
    throw new Error('Files can be up to 10 MB');
  }

  const [{ masjid_id }, user] = await Promise.all([getMasjidMembership(), getSessionUser()]);
  if (!user) throw new Error('User not authenticated');

  const path = `${masjid_id}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const bucket = supabase.storage.from(SupabaseBuckets.TaxExemptionCertificates);

  const { error: uploadError } = await bucket.upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    captureSupabaseError(uploadError, {
      source: 'supabase.storage',
      operation: 'upload_tax_exemption_certificate',
      extra: { size: file.size, type: file.type },
    });
    throw uploadError;
  }

  const { data, error } = await supabase
    .from(SupabaseTables.TaxExemptionCertificates)
    .insert({
      masjid_id,
      state,
      storage_path: path,
      file_name: file.name,
      content_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    await bucket.remove([path]);
    throw error;
  }
  return data as TaxExemptionCertificate;
}

/** A short-lived link, since the bucket is private. */
export async function getTaxExemptionCertificateUrl(
  certificate: Pick<TaxExemptionCertificate, 'storage_path'>,
  expiresInSeconds = 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SupabaseBuckets.TaxExemptionCertificates)
    .createSignedUrl(certificate.storage_path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}
