import {
  SupabaseTables,
  type FeedItemKind,
  type MasjidProfile,
  type MasjidReport,
  type MasjidVerification,
  type MemberRole,
  type PlatformMasjid,
  type ReportTarget,
  type VerificationDocument,
} from '@/types';
import supabase from '../index';
import { captureSupabaseError } from '@/lib/sentry';

export type ReviewAction = 'approve' | 'reject' | 'suspend' | 'restore';

export interface MasjidMemberContact {
  user_id: string;
  name: string | null;
  email: string | null;
  role: MemberRole;
}

export async function checkIsPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error) {
    console.error('Error checking platform admin:', error);
    return false;
  }
  return data === true;
}

const MASJID_COLUMNS = 'id, name, area, logo_url, listed, in_app, created_at';

export async function getPlatformMasjids(): Promise<PlatformMasjid[]> {
  const { data, error } = await supabase
    .from(SupabaseTables.MasjidProfiles)
    .select(`${MASJID_COLUMNS}, verification:masjid_verifications(*)`)
    .order('name');

  if (error) throw error;
  return (data ?? []) as unknown as PlatformMasjid[];
}

/** Pending reviews, longest waiting first. */
export async function getVerificationQueue(): Promise<PlatformMasjid[]> {
  const { data, error } = await supabase
    .from(SupabaseTables.MasjidVerifications)
    .select(`*, masjid:masjid_profiles(${MASJID_COLUMNS})`)
    .eq('status', 'pending')
    .order('submitted_at');

  if (error) throw error;
  return ((data ?? []) as unknown as (MasjidVerification & { masjid: PlatformMasjid })[]).map(
    ({ masjid, ...verification }) => ({ ...masjid, verification })
  );
}

export async function getPlatformMasjid(
  id: string
): Promise<{ profile: MasjidProfile; verification: MasjidVerification } | null> {
  const { data, error } = await supabase
    .from(SupabaseTables.MasjidProfiles)
    .select('*, verification:masjid_verifications(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const { verification, ...profile } = data as MasjidProfile & {
    verification: MasjidVerification;
  };
  return { profile: profile as MasjidProfile, verification };
}

export async function getMasjidDocuments(masjidId: string): Promise<VerificationDocument[]> {
  const { data, error } = await supabase
    .from(SupabaseTables.VerificationDocuments)
    .select('*')
    .eq('masjid_id', masjidId)
    .order('created_at');

  if (error) throw error;
  return data ?? [];
}

export type ReportFilter = 'open' | 'actioned' | 'dismissed';

export async function getMasjidReports(options: {
  masjidId?: string;
  filter?: ReportFilter;
}): Promise<MasjidReport[]> {
  let query = supabase
    .from(SupabaseTables.MasjidReports)
    .select(`*, masjid:masjid_profiles(${MASJID_COLUMNS}, verification:masjid_verifications(*))`)
    .order('created_at', { ascending: false });

  if (options.masjidId) query = query.eq('masjid_id', options.masjidId);
  if (options.filter === 'open') query = query.is('resolved_at', null);
  if (options.filter === 'actioned') query = query.in('resolution', ['removed', 'suspended']);
  if (options.filter === 'dismissed') query = query.eq('resolution', 'dismissed');

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as MasjidReport[];
}

const TARGET_TABLES = {
  announcement: SupabaseTables.Announcements,
  event: SupabaseTables.Events,
  post: SupabaseTables.Posts,
} as const;

/** The reported feed items, keyed by id, so the queue can show what was reported. */
export async function getReportTargets(
  reports: MasjidReport[]
): Promise<Map<string, ReportTarget>> {
  const targets = new Map<string, ReportTarget>();

  await Promise.all(
    (Object.keys(TARGET_TABLES) as (keyof typeof TARGET_TABLES)[]).map(async kind => {
      const ids = reports.filter(r => r.target_kind === kind).map(r => r.target_id);
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from(TARGET_TABLES[kind])
        .select(
          kind === 'post'
            ? 'id, title, image_url, removed_at, removal_reason'
            : 'id, title, description, removed_at, removal_reason'
        )
        .in('id', ids);
      if (error) throw error;

      for (const row of (data ?? []) as unknown as ReportTarget[]) targets.set(row.id, row);
    })
  );

  return targets;
}

export async function resolveReport(id: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_masjid_report', { p_report_id: id });
  if (error) throw new Error(error.message || 'Failed to resolve the report');
}

/** Closes every open report on one target without changing anything else. */
export async function dismissReports(kind: MasjidReport['target_kind'], targetId: string) {
  const { error } = await supabase.rpc('close_masjid_reports', {
    p_target_kind: kind,
    p_target_id: targetId,
    p_resolution: 'dismissed',
  });
  if (error) throw new Error(error.message || 'Failed to dismiss the reports');
}

export async function restoreFeedItem(kind: FeedItemKind, id: string): Promise<void> {
  const { error } = await supabase.rpc('set_feed_item_removal', {
    p_kind: kind,
    p_id: id,
    p_removed: false,
  });
  if (error) throw new Error(error.message || 'Failed to restore the item');
}

const invokeReview = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('review-masjid', { body });

  if (error) {
    if ('context' in error && error.context instanceof Response) {
      const detail = await error.context.json().catch(() => null);
      if (detail?.error) throw new Error(detail.error);
    }
    captureSupabaseError(error, { source: 'supabase.functions', operation: 'review_masjid' });
    throw new Error(error.message || 'Request failed');
  }

  return data as T;
};

export async function reviewMasjid(
  action: ReviewAction,
  masjidId: string,
  reason?: string
): Promise<{ verification: MasjidVerification; emailed: boolean }> {
  return invokeReview({ action, masjid_id: masjidId, reason });
}

/** Admins first, then moderators. */
export async function getMasjidMembers(masjidId: string): Promise<MasjidMemberContact[]> {
  const { members } = await invokeReview<{ members: MasjidMemberContact[] }>({
    action: 'contacts',
    masjid_id: masjidId,
  });
  return members;
}

/** Takes a feed item out of the app, closes its reports and emails the masjid. */
export async function removeFeedItem(
  kind: FeedItemKind,
  id: string,
  reason: string
): Promise<{ emailed: boolean }> {
  return invokeReview({ action: 'remove_item', target_kind: kind, target_id: id, reason });
}
