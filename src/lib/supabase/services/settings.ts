import { SupabaseTables, type Settings, type SolarAdjustments } from '@/types';
import { HijriCalculationMethod, CalculationMethod, JuristicSchool } from '@/constants';
import {
  getSessionUser,
  getMasjidMembership,
  insertRecord,
  fetchByColumn,
  updateRecord,
} from '../helpers';
import { getOrCreatePrayerAdjustments } from './prayer-times';

export async function getSettings(masjidId?: string): Promise<Settings | null> {
  try {
    const effectiveMasjidId = masjidId || (await getMasjidMembership()).masjid_id;

    const results = await fetchByColumn<Settings>(
      SupabaseTables.Settings,
      'masjid_id',
      effectiveMasjidId
    );

    if (results.length > 0) {
      return results[0];
    }

    return null;
  } catch (error) {
    console.error('Error in fetchSettings:', error);
    return null;
  }
}

export async function createDefaultSettings(): Promise<Settings> {
  const user = await getSessionUser();
  if (!user) throw new Error('User not authenticated');
  const { masjid_id } = await getMasjidMembership();

  const settingsData: Partial<Settings> = {
    user_id: user.id,
    masjid_id,
    hijri_calculation_method: HijriCalculationMethod.Umm_al_Qura,
    hijri_offset: 0,
    calculation_method: CalculationMethod.Muslim_World_League,
    juristic_school: JuristicSchool.Shafi,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    return await insertRecord<Settings>(SupabaseTables.Settings, settingsData);
  } catch (error) {
    console.error('Error creating default settings:', error);
    throw error;
  }
}

export async function updateHijriSettings(
  method: HijriCalculationMethod,
  offset: number
): Promise<Settings> {
  const settings = await getOrCreateSettings();
  if (!settings) throw new Error('Failed to get or create settings');

  try {
    console.log('Updating hijri settings:', method, offset);
    return await updateRecord<Settings>(SupabaseTables.Settings, settings.id, {
      hijri_calculation_method: method,
      hijri_offset: offset,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in updateHijriSettings:', error);
    throw error;
  }
}

export async function updateSolarAdjustments(adjustments: SolarAdjustments): Promise<Settings> {
  const settings = await getOrCreateSettings();
  if (!settings) throw new Error('Failed to get or create settings');

  try {
    return await updateRecord<Settings>(SupabaseTables.Settings, settings.id, {
      sunrise_adjustment: adjustments.sunrise,
      sunset_adjustment: adjustments.sunset,
      ishraq_adjustment: adjustments.ishraq,
      chasht_adjustment: adjustments.chasht,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in updateSolarAdjustments:', error);
    throw error;
  }
}

export async function updatePrayerCalculationSettings(
  calculationMethod: number,
  juristicSchool: number
): Promise<Settings> {
  const settings = await getOrCreateSettings();
  if (!settings) throw new Error('Failed to get or create settings');

  try {
    return await updateRecord<Settings>(SupabaseTables.Settings, settings.id, {
      calculation_method: calculationMethod,
      juristic_school: juristicSchool,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in updatePrayerCalculationSettings:', error);
    throw error;
  }
}

export async function getOrCreateSettings(): Promise<Settings | null> {
  const existing = await getSettings();
  if (existing) return existing;

  try {
    const created = await createDefaultSettings();
    // Pair the settings defaults with a matching prayer_times row so the
    // display has adjustments (even if empty) to render against.
    await getOrCreatePrayerAdjustments();
    return created;
  } catch {
    // If insert fails due to unique constraint (race condition from concurrent calls),
    // the record was already created — just fetch it.
    return await getSettings();
  }
}
