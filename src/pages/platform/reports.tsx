import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Building2, CalendarDays, Flag, Megaphone } from 'lucide-react';
import { Badge, Button, Card, CardContent, buttonVariants } from '@/components/ui';
import { EmptyState, ErrorAlert, PageHeader } from '@/components/common';
import {
  REPORT_REASON_LABELS,
  REPORT_RESOLUTION_LABELS,
  REPORT_TARGET_LABELS,
  ReasonDialog,
  VerificationStatusBadge,
} from '@/components/platform';
import {
  dismissReports,
  getMasjidReports,
  getReportTargets,
  removeFeedItem,
  restoreFeedItem,
  reviewMasjid,
  type ReportFilter,
} from '@/lib/supabase';
import { useTrigger } from '@/hooks';
import { PlatformRoutes } from '@/constants';
import type { FeedItemKind, MasjidReport, ReportReason, ReportTarget } from '@/types';
import { cn } from '@/utils';

const FILTERS: { value: ReportFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'dismissed', label: 'Dismissed' },
];

/** Every report on one masjid or feed item, newest first. */
interface ReportGroup {
  key: string;
  kind: MasjidReport['target_kind'];
  targetId: string;
  masjidId: string;
  masjid: MasjidReport['masjid'];
  reports: MasjidReport[];
}

const groupReports = (reports: MasjidReport[]): ReportGroup[] => {
  const groups = new Map<string, ReportGroup>();
  for (const report of reports) {
    const key = `${report.target_kind}:${report.target_id}`;
    const group = groups.get(key);
    if (group) group.reports.push(report);
    else
      groups.set(key, {
        key,
        kind: report.target_kind,
        targetId: report.target_id,
        masjidId: report.masjid_id,
        masjid: report.masjid,
        reports: [report],
      });
  }
  return [...groups.values()];
};

const reasonCounts = (reports: MasjidReport[]) => {
  const counts = new Map<ReportReason, number>();
  for (const r of reports) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

type Dialog = { group: ReportGroup; mode: 'remove' | 'suspend' } | null;

export default function PlatformReports() {
  const [trigger, reload] = useTrigger();
  const [filter, setFilter] = useState<ReportFilter>('open');
  const [reports, setReports] = useState<MasjidReport[] | null>(null);
  const [targets, setTargets] = useState<Map<string, ReportTarget>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    let cancelled = false;
    getMasjidReports({ filter })
      .then(async loaded => {
        const loadedTargets = await getReportTargets(loaded);
        if (cancelled) return;
        setReports(loaded);
        setTargets(loadedTargets);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) {
          setError('Failed to load reports');
          setReports([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filter, trigger]);

  const groups = useMemo(() => groupReports(reports ?? []), [reports]);

  const run = async (group: ReportGroup, action: () => Promise<void>) => {
    try {
      setBusyKey(group.key);
      await action();
      setDialog(null);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDismiss = (group: ReportGroup) =>
    run(group, async () => {
      await dismissReports(group.kind, group.targetId);
      toast.success('Reports dismissed');
    });

  const handleRestore = (group: ReportGroup) =>
    run(group, async () => {
      await restoreFeedItem(group.kind as FeedItemKind, group.targetId);
      toast.success('Back in the app');
    });

  const handleConfirm = (reason: string) => {
    if (!dialog) return Promise.resolve();
    const { group, mode } = dialog;
    return run(group, async () => {
      if (mode === 'suspend') {
        await reviewMasjid('suspend', group.masjidId, reason);
        toast.success('Masjid suspended from the app');
        return;
      }
      const { emailed } = await removeFeedItem(group.kind as FeedItemKind, group.targetId, reason);
      if (emailed) toast.success("Removed from the app. The masjid's admins were emailed.");
      else
        toast.warning(
          "Removed from the app, but the email to the masjid's admins couldn't be sent."
        );
    });
  };

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Reports'
        description='What app users reported, grouped by masjid or post'
        showAddButton={false}
      />
      <ErrorAlert message={error} onClose={() => setError(null)} />
      <div className='flex gap-1'>
        {FILTERS.map(option => (
          <Button
            key={option.value}
            size='sm'
            variant='ghost'
            className={cn(filter === option.value && 'bg-accent text-accent-foreground')}
            onClick={() => {
              setReports(null);
              setFilter(option.value);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {reports === null ? (
        <div className='space-y-3'>
          {[0, 1, 2].map(i => (
            <div key={i} className='animate-pulse bg-muted rounded-xl h-32' />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Flag className='h-6 w-6 text-muted-foreground' />}
              title={filter === 'open' ? 'No open reports' : `Nothing ${filter} yet`}
              description='Reports from the Alkhairia app appear here.'
            />
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {groups.map(group => (
            <ReportGroupCard
              key={group.key}
              group={group}
              target={targets.get(group.targetId)}
              busy={busyKey === group.key}
              onRemove={() => setDialog({ group, mode: 'remove' })}
              onSuspend={() => setDialog({ group, mode: 'suspend' })}
              onDismiss={() => handleDismiss(group)}
              onRestore={() => handleRestore(group)}
            />
          ))}
        </div>
      )}

      <ReasonDialog
        isOpen={dialog?.mode === 'remove'}
        title={`Remove this ${dialog ? REPORT_TARGET_LABELS[dialog.group.kind].toLowerCase() : 'item'} from the app`}
        description="It leaves the masjid's feed in the Alkhairia app but stays on its screens. The masjid's admins are emailed this reason."
        confirmLabel='Remove from app'
        reasonRequired
        isSaving={!!dialog && busyKey === dialog.group.key}
        onConfirm={handleConfirm}
        onClose={() => setDialog(null)}
      />
      <ReasonDialog
        isOpen={dialog?.mode === 'suspend'}
        title='Suspend from the Alkhairia app'
        description="Removes the masjid from the directory, feed and notifications. The masjid's admins see this reason in the console."
        confirmLabel='Suspend'
        reasonRequired={false}
        isSaving={!!dialog && busyKey === dialog.group.key}
        onConfirm={handleConfirm}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

interface ReportGroupCardProps {
  group: ReportGroup;
  target: ReportTarget | undefined;
  busy: boolean;
  onRemove: () => void;
  onSuspend: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}

function ReportGroupCard({
  group,
  target,
  busy,
  onRemove,
  onSuspend,
  onDismiss,
  onRestore,
}: ReportGroupCardProps) {
  const { kind, masjid, reports } = group;
  const isMasjid = kind === 'masjid';
  const latest = reports[0];
  const isOpen = !latest.resolved_at;
  const isSuspended = !!masjid?.verification?.suspended_at;
  const isDeleted = !isMasjid && !target;
  const isRemoved = !!target?.removed_at;
  const withDetails = reports.filter(r => r.details);
  const masjidLink = PlatformRoutes.Masjid.replace(':id', group.masjidId);

  const title = isMasjid ? (masjid?.name ?? 'Unknown masjid') : target?.title || null;
  const body = isMasjid ? masjid?.area : target?.description;

  return (
    <Card className='py-0'>
      <CardContent className='flex gap-4 p-4 sm:p-5'>
        <Thumbnail group={group} target={target} />

        <div className='min-w-0 flex-1 space-y-3'>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-sm'>
            <Badge variant='secondary' className='uppercase tracking-wide text-[10px]'>
              {REPORT_TARGET_LABELS[kind]}
            </Badge>
            {!isMasjid && (
              <Link to={masjidLink} className='font-medium hover:underline underline-offset-2'>
                {masjid?.name ?? 'Unknown masjid'}
              </Link>
            )}
            <VerificationStatusBadge verification={masjid?.verification ?? null} />
            <span className='ml-auto text-xs text-muted-foreground whitespace-nowrap'>
              {reports.length} {reports.length === 1 ? 'report' : 'reports'} ·{' '}
              {formatDistanceToNow(new Date(latest.created_at), { addSuffix: true })}
            </span>
          </div>

          <div className='space-y-1'>
            {isMasjid ? (
              <Link to={masjidLink} className='font-medium hover:underline underline-offset-2'>
                {title}
              </Link>
            ) : isDeleted ? (
              <p className='text-muted-foreground italic'>The masjid has since deleted this.</p>
            ) : (
              title && <p className='font-medium line-clamp-2'>{title}</p>
            )}
            {body && <p className='text-sm text-muted-foreground line-clamp-2'>{body}</p>}
            {isRemoved && (
              <p className='text-sm text-destructive'>
                Removed from the app: {target?.removal_reason}
              </p>
            )}
          </div>

          <div className='flex flex-wrap gap-1.5'>
            {reasonCounts(reports).map(([reason, count]) => (
              <Badge key={reason} variant='outline' className='font-normal'>
                {REPORT_REASON_LABELS[reason]}
                {count > 1 && <span className='text-muted-foreground'>×{count}</span>}
              </Badge>
            ))}
          </div>

          {withDetails.length > 0 && (
            <ul className='space-y-1'>
              {withDetails.map(r => (
                <li
                  key={r.id}
                  className='border-l-2 pl-3 text-sm text-muted-foreground whitespace-pre-wrap break-words'
                >
                  {r.details}
                </li>
              ))}
            </ul>
          )}

          <div className='flex flex-wrap items-center gap-2 pt-1'>
            {isOpen ? (
              <>
                {!isMasjid && !isDeleted && !isRemoved && (
                  <Button size='sm' variant='destructive' onClick={onRemove} disabled={busy}>
                    Remove from app
                  </Button>
                )}
                {isMasjid && !isSuspended && (
                  <Button size='sm' variant='destructive' onClick={onSuspend} disabled={busy}>
                    Suspend masjid
                  </Button>
                )}
                <Button size='sm' variant='outline' onClick={onDismiss} loading={busy}>
                  Dismiss
                </Button>
                {isMasjid && (
                  <Link
                    to={masjidLink}
                    className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                  >
                    Review masjid
                  </Link>
                )}
              </>
            ) : (
              <>
                <span className='text-sm text-muted-foreground'>
                  {latest.resolution ? REPORT_RESOLUTION_LABELS[latest.resolution] : 'Closed'} ·{' '}
                  {format(new Date(latest.resolved_at as string), 'd MMM, h:mm a')}
                </span>
                {latest.resolution === 'removed' && isRemoved && (
                  <Button size='sm' variant='outline' onClick={onRestore} loading={busy}>
                    Restore to app
                  </Button>
                )}
                {latest.resolution === 'suspended' && isSuspended && (
                  <Link
                    to={masjidLink}
                    className={buttonVariants({ size: 'sm', variant: 'outline' })}
                  >
                    Manage suspension
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Thumbnail({ group, target }: { group: ReportGroup; target: ReportTarget | undefined }) {
  const box = 'h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-md border';
  const image = group.kind === 'masjid' ? group.masjid?.logo_url : target?.image_url;

  if (image) {
    return (
      <a href={image} target='_blank' rel='noopener noreferrer' className='shrink-0'>
        <img src={image} alt='' className={cn(box, 'object-cover')} />
      </a>
    );
  }

  const Icon = {
    masjid: Building2,
    announcement: Megaphone,
    event: CalendarDays,
    post: Flag,
  }[group.kind];
  return (
    <div className={cn(box, 'bg-muted flex items-center justify-center')}>
      <Icon className='h-6 w-6 text-muted-foreground' />
    </div>
  );
}
