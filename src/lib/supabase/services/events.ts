import { SupabaseTables, type Event } from '@/types';
import type { EventData } from '../../zod';
import supabase from '../index';
import {
  getCurrentUser,
  getMasjidMembership,
  updateRecord,
  insertRecord,
  handleSupabaseError,
} from '../helpers';
import { removeScreenAssignments } from './screens';

/** Which side of "now" to return. Filtered on the indexed `ends_at` column. */
export type EventScope = 'all' | 'upcoming' | 'past';

export async function getEvents(masjidId?: string, scope: EventScope = 'all'): Promise<Event[]> {
  const effectiveMasjidId = masjidId || (await getMasjidMembership()).masjid_id;

  let query = supabase
    .from(SupabaseTables.Events)
    .select('*')
    .eq('masjid_id', effectiveMasjidId)
    .or('archived.is.null,archived.eq.false');

  // PostgREST has no server-side now(), so the boundary is sent as an instant
  const now = new Date().toISOString();
  if (scope === 'upcoming') query = query.gte('ends_at', now);
  if (scope === 'past') query = query.lt('ends_at', now);

  query = query.order('date_time', { ascending: scope !== 'past' });

  const { data, error } = await query;
  if (error) throw handleSupabaseError(error, 'Error fetching events');

  return (data ?? []) as Event[];
}

/** `publish` applies only when creating; edits keep the item's publish state. */
export async function upsertEvent(event: EventData & { id?: string }, publish = true) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  const { masjid_id } = await getMasjidMembership();

  const eventToUpsert: Partial<Event> = {
    ...event,
    end_time: event.end_time || null,
    user_id: user.id,
    masjid_id,
    updated_at: new Date().toISOString(),
    archived: false,
  };

  if (event.id) {
    return await updateRecord<Event>(SupabaseTables.Events, event.id, eventToUpsert);
  } else {
    eventToUpsert.created_at = new Date().toISOString();
    eventToUpsert.published_at = publish ? eventToUpsert.created_at : null;

    return await insertRecord<Event>(SupabaseTables.Events, eventToUpsert);
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  const updates: Partial<Event> = { archived: true, updated_at: new Date().toISOString() };

  await updateRecord<Event>(SupabaseTables.Events, id, updates);
  await removeScreenAssignments(id);
  return true;
}
