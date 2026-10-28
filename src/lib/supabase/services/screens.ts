import {
  SupabaseTables,
  type CustomThemeConfig,
  type DisplayScreen,
  type ScreenContent,
  type ScreenContentType,
  type Theme,
} from '@/types';
import type { ScreenData } from '../../zod';
import {
  getCurrentUser,
  getMasjidMembership,
  fetchByColumn,
  updateRecord,
  insertRecord,
} from '../helpers';
import { generateScreenCode } from '@/utils';
import supabase from '../index';

/** A screen plus the heartbeat timestamp its display last reported. */
export type DisplayScreenWithHeartbeat = DisplayScreen & { last_seen_at: string | null };

export async function getScreens(): Promise<DisplayScreenWithHeartbeat[]> {
  const { masjid_id } = await getMasjidMembership();

  const screens = await fetchByColumn<DisplayScreen>(
    SupabaseTables.DisplayScreens,
    'masjid_id',
    masjid_id
  );
  if (screens.length === 0) return [];

  // Heartbeats live in their own table so display writes don't churn
  // display_screens (see the screen_heartbeats migration), hence the second query.
  const { data, error } = await supabase
    .from(SupabaseTables.ScreenHeartbeats)
    .select('screen_id, last_seen_at')
    .in(
      'screen_id',
      screens.map(screen => screen.id)
    );

  if (error) throw error;

  const lastSeenByScreenId = new Map<string, string>(
    (data || []).map(row => [row.screen_id as string, row.last_seen_at as string])
  );

  return screens.map(screen => ({
    ...screen,
    last_seen_at: lastSeenByScreenId.get(screen.id) ?? null,
  }));
}

export async function getScreenById(id: string): Promise<DisplayScreen | null> {
  const screens = await fetchByColumn<DisplayScreen>(SupabaseTables.DisplayScreens, 'id', id);
  return screens.length > 0 ? screens[0] : null;
}

/**
 * Stamps the screen's last_seen_at with the current time — called on login and
 * then periodically while the display runs.
 *
 * Displays run as `anon` and have no write access to these tables, so this goes
 * through a SECURITY DEFINER function that only touches the heartbeat row for
 * the screen matching the code.
 */
export async function recordScreenHeartbeat(code: string): Promise<void> {
  const { error } = await supabase.rpc('record_screen_heartbeat', { p_code: code });
  if (error) throw error;
}

export async function createScreen(data: ScreenData): Promise<DisplayScreen> {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  const { masjid_id } = await getMasjidMembership();

  const screenToInsert: Partial<DisplayScreen> = {
    ...data,
    user_id: user.id,
    masjid_id,
    code: generateScreenCode(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return await insertRecord<DisplayScreen>(SupabaseTables.DisplayScreens, screenToInsert);
}

export async function updateScreen(id: string, data: ScreenData): Promise<DisplayScreen> {
  return await updateRecord<DisplayScreen>(SupabaseTables.DisplayScreens, id, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function updateScreenTheme(id: string, theme: Theme): Promise<DisplayScreen> {
  return await updateRecord<DisplayScreen>(SupabaseTables.DisplayScreens, id, {
    theme,
    updated_at: new Date().toISOString(),
  });
}

export async function updateScreenCustomTheme(
  id: string,
  customTheme: CustomThemeConfig
): Promise<DisplayScreen> {
  return await updateRecord<DisplayScreen>(SupabaseTables.DisplayScreens, id, {
    custom_theme: customTheme,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteScreen(id: string): Promise<boolean> {
  const { error } = await supabase.from(SupabaseTables.DisplayScreens).delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function removeScreenAssignments(contentId: string): Promise<void> {
  const { error } = await supabase
    .from(SupabaseTables.ScreenContent)
    .delete()
    .eq('content_id', contentId);

  if (error) throw error;
}

export async function getScreenContent(screenId: string): Promise<ScreenContent[]> {
  const { data, error } = await supabase
    .from(SupabaseTables.ScreenContent)
    .select('*')
    .eq('screen_id', screenId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data as ScreenContent[];
}

export type ScreenContentWithDetails = ScreenContent & {
  title: string;
  description: string;
};

export async function getScreenContentWithDetails(
  screenId: string
): Promise<ScreenContentWithDetails[]> {
  const rows = await getScreenContent(screenId);
  if (rows.length === 0) return [];

  // Group content IDs by type
  const idsByType: Record<string, string[]> = {};
  for (const row of rows) {
    if (!idsByType[row.content_type]) idsByType[row.content_type] = [];
    idsByType[row.content_type].push(row.content_id);
  }

  // Batch fetch from each table
  const contentMap = new Map<string, { title: string; description: string }>();

  const fetchFromTable = async (
    table: string,
    ids: string[],
    titleKey: string,
    descKey: string
  ) => {
    if (ids.length === 0) return;
    const { data, error } = await supabase.from(table).select('*').in('id', ids);
    if (error) throw error;
    for (const item of data || []) {
      contentMap.set(item.id, {
        title: item[titleKey] || item[descKey] || '',
        description: item[descKey] || '',
      });
    }
  };

  const fetchAyatAndHadith = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data, error } = await supabase
      .from('ayat_and_hadith')
      .select('id, type, source, cached_text')
      .in('id', ids);
    if (error) throw error;
    for (const item of data || []) {
      const arabicPreview =
        typeof item.cached_text?.arabic === 'string' ? item.cached_text.arabic.slice(0, 80) : '';
      contentMap.set(item.id, {
        title: item.type === 'ayat' ? 'Ayat' : 'Hadith',
        description: arabicPreview,
      });
    }
  };

  await Promise.all([
    fetchFromTable('announcements', idsByType['announcements'] || [], 'title', 'description'),
    fetchFromTable('events', idsByType['events'] || [], 'title', 'description'),
    fetchFromTable('posts', idsByType['posts'] || [], 'title', 'title'),
    fetchFromTable('youtube_videos', idsByType['youtube_videos'] || [], 'title', 'youtube_url'),
    fetchAyatAndHadith(idsByType['ayat_and_hadith'] || []),
  ]);

  return rows.map(row => ({
    ...row,
    title: contentMap.get(row.content_id)?.title || 'Unknown',
    description: contentMap.get(row.content_id)?.description || '',
  }));
}

export async function updateScreenContentOrder(
  items: Array<{ id: string; display_order: number }>
): Promise<void> {
  const updates = items.map(item =>
    supabase
      .from(SupabaseTables.ScreenContent)
      .update({ display_order: item.display_order })
      .eq('id', item.id)
  );

  const results = await Promise.all(updates);
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
}

export async function toggleScreenContentVisibility(id: string, visible: boolean): Promise<void> {
  const { error } = await supabase
    .from(SupabaseTables.ScreenContent)
    .update({ visible })
    .eq('id', id);

  if (error) throw error;
}

export async function getScreensForContent(
  contentId: string,
  contentType: ScreenContentType
): Promise<ScreenContent[]> {
  const { data, error } = await supabase
    .from(SupabaseTables.ScreenContent)
    .select('*')
    .eq('content_id', contentId)
    .eq('content_type', contentType);

  if (error) throw error;
  return data as ScreenContent[];
}

export async function bulkUpdateScreenAssignments(
  contentId: string,
  contentType: ScreenContentType,
  screenIds: string[]
): Promise<void> {
  // Get existing assignments to preserve order of kept items
  const { data: existing, error: fetchError } = await supabase
    .from(SupabaseTables.ScreenContent)
    .select('*')
    .eq('content_id', contentId)
    .eq('content_type', contentType);

  if (fetchError) throw fetchError;

  const existingScreenIds = new Set((existing || []).map(r => r.screen_id));
  const newScreenIds = screenIds.filter(id => !existingScreenIds.has(id));
  const removedScreenIds = [...existingScreenIds].filter(id => !screenIds.includes(id));

  // Delete removed assignments
  if (removedScreenIds.length > 0) {
    const { error: deleteError } = await supabase
      .from(SupabaseTables.ScreenContent)
      .delete()
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .in('screen_id', removedScreenIds);

    if (deleteError) throw deleteError;
  }

  // Insert new assignments with auto-incrementing display_order
  if (newScreenIds.length > 0) {
    // For each new screen, get the max display_order for that screen
    const inserts = await Promise.all(
      newScreenIds.map(async screenId => {
        const { data: maxRow } = await supabase
          .from(SupabaseTables.ScreenContent)
          .select('display_order')
          .eq('screen_id', screenId)
          .order('display_order', { ascending: false })
          .limit(1);

        const maxOrder = maxRow && maxRow.length > 0 ? maxRow[0].display_order : 0;

        return {
          screen_id: screenId,
          content_id: contentId,
          content_type: contentType,
          display_order: maxOrder + 1,
          visible: true,
        };
      })
    );

    const { error: insertError } = await supabase
      .from(SupabaseTables.ScreenContent)
      .insert(inserts);

    if (insertError) throw insertError;
  }
}
