import {
  SupabaseBuckets,
  SupabaseTables,
  type AyatAndHadith,
  type AyatHadithStyle,
  type AyatHadithCachedText,
  type AyatHadithType,
  type AyatSource,
  type HadithSource,
  type ScreenOrientation,
} from '@/types';
import {
  fetchById,
  getCurrentUser,
  getMasjidMembership,
  updateRecord,
  insertRecord,
  fetchByMultipleConditions,
} from '../helpers';
import supabase from '../index';
import { removeScreenAssignments } from './screens';

export async function getAyatAndHadith(masjidId?: string): Promise<AyatAndHadith[]> {
  const effectiveMasjidId = masjidId || (await getMasjidMembership()).masjid_id;

  const conditions = [
    { column: 'masjid_id', value: effectiveMasjidId },
    { column: 'archived', value: false, isNull: true },
  ];

  return await fetchByMultipleConditions<AyatAndHadith>(SupabaseTables.AyatAndHadith, conditions);
}

export async function getAyatAndHadithById(id: string): Promise<AyatAndHadith | null> {
  return await fetchById<AyatAndHadith>(SupabaseTables.AyatAndHadith, id);
}

export interface UpsertAyatAndHadithInput {
  id?: string;
  type: AyatHadithType;
  orientation: ScreenOrientation;
  source: AyatSource | HadithSource;
  cached_text: AyatHadithCachedText;
  style: AyatHadithStyle;
  imageBlob: Blob;
  previousImagePath?: string;
  /** Applies only when creating; edits keep the item's publish state. Defaults to true. */
  publish?: boolean;
}

export async function upsertAyatAndHadith(input: UpsertAyatAndHadithInput): Promise<AyatAndHadith> {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  const { masjid_id } = await getMasjidMembership();

  // Masjid-prefixed so the storage RLS policy can scope writes by folder.
  const imagePath = `${masjid_id}/${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from(SupabaseBuckets.AyatHadithSlides)
    .upload(imagePath, input.imageBlob, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from(SupabaseBuckets.AyatHadithSlides)
    .getPublicUrl(imagePath);

  const toUpsert: Partial<AyatAndHadith> = {
    user_id: user.id,
    masjid_id,
    type: input.type,
    orientation: input.orientation,
    source: input.source,
    cached_text: input.cached_text,
    style: input.style,
    image_url: urlData.publicUrl,
    image_path: imagePath,
    archived: false,
    updated_at: new Date().toISOString(),
  };

  let record: AyatAndHadith;
  if (input.id) {
    record = await updateRecord<AyatAndHadith>(SupabaseTables.AyatAndHadith, input.id, toUpsert);
  } else {
    toUpsert.created_at = new Date().toISOString();
    toUpsert.published_at = input.publish === false ? null : toUpsert.created_at;
    record = await insertRecord<AyatAndHadith>(SupabaseTables.AyatAndHadith, toUpsert);
  }

  // Best-effort cleanup of replaced image
  if (input.previousImagePath && input.previousImagePath !== imagePath) {
    await supabase.storage
      .from(SupabaseBuckets.AyatHadithSlides)
      .remove([input.previousImagePath])
      .catch(err => console.warn('Failed to remove previous image:', err));
  }

  return record;
}

export async function deleteAyatAndHadith(id: string, imagePath?: string): Promise<boolean> {
  const updates: Partial<AyatAndHadith> = {
    archived: true,
    updated_at: new Date().toISOString(),
  };

  await updateRecord<AyatAndHadith>(SupabaseTables.AyatAndHadith, id, updates);
  await removeScreenAssignments(id);

  if (imagePath) {
    await supabase.storage
      .from(SupabaseBuckets.AyatHadithSlides)
      .remove([imagePath])
      .catch(err => console.warn('Failed to remove slide image:', err));
  }

  return true;
}
