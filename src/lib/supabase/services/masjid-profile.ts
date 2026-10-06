import { SupabaseBuckets, SupabaseTables, type MasjidProfile } from '@/types';
import type { MasjidProfileData } from '../../zod';
import {
  getCurrentUser,
  getMasjidMembership,
  uploadFile,
  fetchByColumn,
  fetchById,
  updateRecord,
  insertRecord,
} from '../helpers';
import { useAuthStore } from '@/store';
import supabase from '../index';

/**
 * Gets the masjid profile for the current authenticated user
 * @returns Promise resolving to masjid profile or null if not found
 */
export async function getMasjidProfile(): Promise<MasjidProfile | null> {
  try {
    const { masjid_id } = await getMasjidMembership();
    return await fetchById<MasjidProfile>(SupabaseTables.MasjidProfiles, masjid_id);
  } catch {
    // Fallback for users who haven't been added to masjid_members yet (e.g. during registration)
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const profiles = await fetchByColumn<MasjidProfile>(
      SupabaseTables.MasjidProfiles,
      'user_id',
      user.id
    );
    return profiles.length > 0 ? profiles[0] : null;
  }
}

/**
 * Creates or updates a masjid profile with optional logo upload
 * @param profileData The profile data to save
 * @param logoFile Optional logo file to upload
 * @param shouldRemoveLogo Whether to remove the existing logo
 * @returns Promise resolving to the created/updated profile
 */
export async function upsertMasjidProfile(
  profileData: MasjidProfileData,
  logoFile: File | null,
  shouldRemoveLogo: boolean = false
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  // The profile lookup moved ahead of the upload: logos are now stored under a
  // `<masjid_id>/` prefix so the storage policy can scope writes by folder, and
  // the masjid id is the profile's own id. A profile being created for the
  // first time has no id yet, so its logo is uploaded after the insert below.
  const profiles = await fetchByColumn<MasjidProfile>(
    SupabaseTables.MasjidProfiles,
    'user_id',
    user.id
  );
  const existingProfile = profiles.length > 0 ? profiles[0] : null;

  let logoUrl = undefined;

  if (logoFile && existingProfile) {
    logoUrl = await uploadFile(
      SupabaseBuckets.MasjidLogos,
      logoFile,
      `${existingProfile.id}/${Date.now()}`
    );
  }

  const profileToUpsert: Partial<MasjidProfile> = {
    ...profileData,
    user_id: user.id,
    updated_at: new Date().toISOString(),
    latitude: profileData.latitude || null,
    longitude: profileData.longitude || null,
    timezone: profileData.timezone,
    name: profileData.name,
    name_ur: profileData.name_ur ?? '',
    name_ar: profileData.name_ar ?? '',
    area: profileData.area,
    area_ur: profileData.area_ur ?? '',
    area_ar: profileData.area_ar ?? '',
    contact_number: profileData.contact_number ?? '',
    contact_email: profileData.contact_email ?? '',
    website: profileData.website ?? '',
  };

  // A listed masjid must keep its pin, so losing the pin un-lists it.
  if (!profileData.latitude || !profileData.longitude) profileToUpsert.listed = false;

  if (logoUrl) profileToUpsert.logo_url = logoUrl;
  else if (shouldRemoveLogo) profileToUpsert.logo_url = '';

  if (existingProfile) {
    return await updateRecord<MasjidProfile>(
      SupabaseTables.MasjidProfiles,
      existingProfile.id as string,
      profileToUpsert
    );
  } else {
    profileToUpsert.created_at = new Date().toISOString();
    const created = await insertRecord<MasjidProfile>(
      SupabaseTables.MasjidProfiles,
      profileToUpsert
    );
    // The on_masjid_profile_insert trigger creates the admin membership
    // server-side; mirror that into the client auth store.
    useAuthStore.getState().setAuth(created.id, 'admin');

    // A first-time profile only gets its masjid id here, and the storage policy
    // requires the logo to sit under that id, so the upload waits until now.
    if (!logoFile) return created;

    const newLogoUrl = await uploadFile(
      SupabaseBuckets.MasjidLogos,
      logoFile,
      `${created.id}/${Date.now()}`
    );
    return await updateRecord<MasjidProfile>(SupabaseTables.MasjidProfiles, created.id, {
      logo_url: newLogoUrl,
      updated_at: new Date().toISOString(),
    });
  }
}

/** Lists the masjid in the Alkhairia app's directory, or withdraws it. */
export async function setMasjidListed(listed: boolean): Promise<MasjidProfile> {
  const { masjid_id } = await getMasjidMembership();
  return await updateRecord<MasjidProfile>(SupabaseTables.MasjidProfiles, masjid_id, {
    listed,
    updated_at: new Date().toISOString(),
  });
}

export type PublicMasjid = Pick<MasjidProfile, 'id' | 'name' | 'area' | 'logo_url'>;

/**
 * A listed masjid as the Alkhairia app sees it, for the signed-out follow page.
 * Resolves to null when the masjid is gone or no longer listed.
 */
export async function getPublicMasjid(id: string): Promise<PublicMasjid | null> {
  const { data, error } = await supabase.functions.invoke(`masjid-directory/masjids?ids=${id}`, {
    method: 'GET',
  });
  if (error) throw error;
  return (data as { masjids?: PublicMasjid[] } | null)?.masjids?.[0] ?? null;
}
