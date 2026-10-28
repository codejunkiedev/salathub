import { SupabaseTables, type Announcement } from '@/types';
import type { AnnouncementData } from '../../zod';
import {
  getCurrentUser,
  getMasjidMembership,
  updateRecord,
  insertRecord,
  fetchByMultipleConditions,
} from '../helpers';
import { removeScreenAssignments } from './screens';

export async function getAnnouncements(masjidId?: string): Promise<Announcement[]> {
  const effectiveMasjidId = masjidId || (await getMasjidMembership()).masjid_id;

  const conditions = [
    { column: 'masjid_id', value: effectiveMasjidId },
    { column: 'archived', value: false, isNull: true },
  ];

  return await fetchByMultipleConditions<Announcement>(SupabaseTables.Announcements, conditions);
}

/** `publish` applies only when creating; edits keep the item's publish state. */
export async function upsertAnnouncement(
  announcement: AnnouncementData & { id?: string },
  publish = true
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  const { masjid_id } = await getMasjidMembership();

  const announcementToUpsert: Partial<Announcement> = {
    ...announcement,
    user_id: user.id,
    masjid_id,
    updated_at: new Date().toISOString(),
    archived: false,
  };

  if (announcement.id) {
    return await updateRecord<Announcement>(
      SupabaseTables.Announcements,
      announcement.id,
      announcementToUpsert
    );
  } else {
    announcementToUpsert.created_at = new Date().toISOString();
    announcementToUpsert.published_at = publish ? announcementToUpsert.created_at : null;

    return await insertRecord<Announcement>(SupabaseTables.Announcements, announcementToUpsert);
  }
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const updates: Partial<Announcement> = { archived: true, updated_at: new Date().toISOString() };

  await updateRecord<Announcement>(SupabaseTables.Announcements, id, updates);
  await removeScreenAssignments(id);
  return true;
}
