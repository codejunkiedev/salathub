import { SupabaseTables, type PrayerTimes } from '@/types';
import type { PrayerAdjustmentsFormData } from '../../zod';
import {
  getSessionUser,
  getMasjidMembership,
  fetchByColumn,
  updateRecord,
  insertRecord,
} from '../helpers';

/**
 * Gets prayer adjustments for a masjid
 * @param masjidId Optional masjid ID, if not provided uses current user's masjid
 * @returns Promise resolving to prayer adjustments or null if not found
 */
export async function getPrayerAdjustments(masjidId?: string): Promise<PrayerTimes | null> {
  const effectiveMasjidId = masjidId || (await getMasjidMembership()).masjid_id;

  const prayerTimes = await fetchByColumn<PrayerTimes>(
    SupabaseTables.PrayerTimes,
    'masjid_id',
    effectiveMasjidId
  );
  return prayerTimes.length > 0 ? prayerTimes[0] : null;
}

/**
 * Gets the prayer_times row for the current user's masjid, creating a default
 * (empty-adjustments) row if one does not exist yet.
 */
export async function getOrCreatePrayerAdjustments(): Promise<PrayerTimes | null> {
  const existing = await getPrayerAdjustments();
  if (existing) return existing;

  const user = await getSessionUser();
  if (!user) return null;
  const { masjid_id } = await getMasjidMembership();

  try {
    const now = new Date().toISOString();
    return await insertRecord<PrayerTimes>(SupabaseTables.PrayerTimes, {
      user_id: user.id,
      masjid_id,
      created_at: now,
      updated_at: now,
    });
  } catch {
    // Race or unique-constraint violation — another caller created it; just fetch.
    return await getPrayerAdjustments();
  }
}

/**
 * Saves or updates prayer adjustments for the current user's masjid
 * @param settings The prayer adjustments data to save
 * @returns Promise resolving to the saved prayer adjustments
 */
export async function savePrayerAdjustments(
  settings: PrayerAdjustmentsFormData
): Promise<PrayerTimes> {
  const user = await getSessionUser();
  if (!user) throw new Error('User not authenticated');
  const { masjid_id } = await getMasjidMembership();

  const existing = await getPrayerAdjustments(masjid_id);

  const settingsToUpsert: Partial<PrayerTimes> = {
    ...settings,
    user_id: user.id,
    masjid_id,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    return await updateRecord<PrayerTimes>(
      SupabaseTables.PrayerTimes,
      existing.id as string,
      settingsToUpsert
    );
  } else {
    settingsToUpsert.created_at = new Date().toISOString();
    return await insertRecord<PrayerTimes>(SupabaseTables.PrayerTimes, settingsToUpsert);
  }
}
