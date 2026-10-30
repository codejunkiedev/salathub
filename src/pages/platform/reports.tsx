import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Flag } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import { DataTable, EmptyState, ErrorAlert, PageHeader, type Column } from '@/components/common';
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from '@/components/platform';
import { getMasjidReports, getReportTargets, resolveReport } from '@/lib/supabase';
import { useTrigger } from '@/hooks';
import { PlatformRoutes } from '@/constants';
import type { MasjidReport, ReportTarget } from '@/types';
import { cn } from '@/utils';

export default function PlatformReports() {
  const [trigger, reload] = useTrigger();
  const [showAll, setShowAll] = useState(false);
  const [reports, setReports] = useState<MasjidReport[] | null>(null);
  const [targets, setTargets] = useState<Map<string, ReportTarget>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMasjidReports({ open: !showAll })
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
  }, [showAll, trigger]);

  const handleResolve = async (report: MasjidReport) => {
    try {
      setResolvingId(report.id);
      await resolveReport(report.id);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve the report');
    } finally {
      setResolvingId(null);
    }
  };

  const describeTarget = (report: MasjidReport) => {
    if (report.target_kind === 'masjid') return 'The masjid itself';
    const target = targets.get(report.target_id);
    if (!target) return `${REPORT_TARGET_LABELS[report.target_kind]} (deleted)`;
    return (
      <div className='space-y-1'>
        <p>
          <span className='text-muted-foreground'>{REPORT_TARGET_LABELS[report.target_kind]}:</span>{' '}
          {target.title}
        </p>
        {target.description && (
          <p className='text-xs text-muted-foreground line-clamp-2'>{target.description}</p>
        )}
        {target.image_url && (
          <a href={target.image_url} target='_blank' rel='noopener noreferrer'>
            <img src={target.image_url} alt='' className='h-16 rounded border object-cover' />
          </a>
        )}
      </div>
    );
  };

  const columns: Column<MasjidReport>[] = [
    {
      key: 'created_at',
      name: 'Reported',
      width: 'w-[14%]',
      render: value => format(new Date(value as string), 'd MMM, h:mm a'),
    },
    {
      key: 'masjid',
      name: 'Masjid',
      width: 'w-[18%]',
      render: (_, item) => (
        <Link
          to={PlatformRoutes.Masjid.replace(':id', item.masjid_id)}
          className='font-medium hover:underline underline-offset-2'
        >
          {item.masjid?.name ?? 'Unknown'}
        </Link>
      ),
    },
    {
      key: 'target',
      name: 'What',
      width: 'w-[30%]',
      render: (_, item) => describeTarget(item),
    },
    {
      key: 'reason',
      name: 'Reason',
      width: 'w-[14%]',
      render: (_, item) => REPORT_REASON_LABELS[item.reason],
    },
    {
      key: 'details',
      name: 'Details',
      width: 'w-[24%]',
      render: value => (
        <span className='whitespace-pre-wrap break-words text-muted-foreground'>
          {(value as string | null) ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Reports'
        description='What app users reported about a masjid or its posts, newest first'
        showAddButton={false}
      />
      <ErrorAlert message={error} onClose={() => setError(null)} />
      <div className='flex gap-1'>
        {[
          { all: false, label: 'Open' },
          { all: true, label: 'All' },
        ].map(option => (
          <Button
            key={option.label}
            size='sm'
            variant='ghost'
            className={cn(showAll === option.all && 'bg-accent text-accent-foreground')}
            onClick={() => setShowAll(option.all)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent>
          {reports === null ? (
            <div className='animate-pulse bg-muted rounded-lg h-48' />
          ) : reports.length === 0 ? (
            <EmptyState
              icon={<Flag className='h-6 w-6 text-muted-foreground' />}
              title={showAll ? 'No reports yet' : 'No open reports'}
              description='Reports from the Alkhairia app appear here.'
            />
          ) : (
            <DataTable
              columns={columns}
              data={reports}
              keyField='id'
              actionsWidth='w-[10%]'
              renderActions={item =>
                item.resolved_at ? (
                  <span className='text-xs text-muted-foreground'>Resolved</span>
                ) : (
                  <Button
                    size='sm'
                    variant='outline'
                    loading={resolvingId === item.id}
                    onClick={() => handleResolve(item)}
                  >
                    Resolve
                  </Button>
                )
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
