import {
  SupabaseBuckets,
  SupabaseTables,
  type MasjidVerification,
  type VerificationDocument,
  type VerificationDocumentKind,
} from '@/types';
import supabase from '../index';
import { getCurrentUser, getMasjidMembership } from '../helpers';
import { captureSupabaseError } from '@/lib/sentry';

export const VERIFICATION_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const VERIFICATION_MAX_FILE_SIZE = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export async function getMasjidVerification(): Promise<MasjidVerification | null> {
  const { masjid_id } = await getMasjidMembership();

  const { data, error } = await supabase
    .from(SupabaseTables.MasjidVerifications)
    .select('*')
    .eq('masjid_id', masjid_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getVerificationDocuments(): Promise<VerificationDocument[]> {
  const { masjid_id } = await getMasjidMembership();

  const { data, error } = await supabase
    .from(SupabaseTables.VerificationDocuments)
    .select('*')
    .eq('masjid_id', masjid_id)
    .order('created_at');

  if (error) throw error;
  return data ?? [];
}

export async function uploadVerificationDocument(
  kind: VerificationDocumentKind,
  file: File
): Promise<VerificationDocument> {
  if (!VERIFICATION_FILE_TYPES.includes(file.type)) {
    throw new Error('Upload a PDF, JPG or PNG file');
  }
  if (file.size > VERIFICATION_MAX_FILE_SIZE) {
    throw new Error('Files can be up to 10 MB');
  }

  const [{ masjid_id }, user] = await Promise.all([getMasjidMembership(), getCurrentUser()]);
  if (!user) throw new Error('User not authenticated');

  const path = `${masjid_id}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const bucket = supabase.storage.from(SupabaseBuckets.VerificationDocuments);

  const { error: uploadError } = await bucket.upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    captureSupabaseError(uploadError, {
      source: 'supabase.storage',
      operation: 'upload_verification_document',
      extra: { kind, size: file.size, type: file.type },
    });
    throw uploadError;
  }

  const { data, error } = await supabase
    .from(SupabaseTables.VerificationDocuments)
    .insert({
      masjid_id,
      kind,
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
  return data as VerificationDocument;
}

export async function removeVerificationDocument(document: VerificationDocument): Promise<void> {
  const { error } = await supabase
    .from(SupabaseTables.VerificationDocuments)
    .delete()
    .eq('id', document.id);
  if (error) throw error;

  const { error: removeError } = await supabase.storage
    .from(SupabaseBuckets.VerificationDocuments)
    .remove([document.storage_path]);
  if (removeError) console.error('Error removing verification file:', removeError);
}

/** A short-lived link, since the bucket is private. */
export async function getVerificationDocumentUrl(
  document: VerificationDocument,
  expiresInSeconds = 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SupabaseBuckets.VerificationDocuments)
    .createSignedUrl(document.storage_path, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

export async function submitMasjidVerification(): Promise<MasjidVerification> {
  const { data, error } = await supabase.rpc('submit_masjid_verification');
  if (error) throw new Error(error.message || 'Failed to submit for review');
  return data as MasjidVerification;
}
