import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';
import { DataTable, EmptyState, ErrorAlert, PageHeader, type Column } from '@/components/common';
import { MasjidCell } from '@/components/platform';
import {
  getPendingTaxExemptions,
  getVerificationQueue,
  type PendingTaxExemption,
} from '@/lib/supabase';
import { PlatformRoutes, usStateName } from '@/constants';
import type { PlatformMasjid } from '@/types';

export default function PlatformQueue() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<PlatformMasjid[] | null>(null);
  const [certificates, setCertificates] = useState<PendingTaxExemption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVerificationQueue()
      .then(setQueue)
      .catch(err => {
        console.error(err);
        setError('Failed to load the review queue');
        setQueue([]);
      });
    getPendingTaxExemptions()
      .then(setCertificates)
      .catch(err => {
        console.error(err);
        setError('Failed to load the tax-exemption certificates');
        setCertificates([]);
      });
  }, []);

  const columns: Column<PlatformMasjid>[] = [
    {
      key: 'name',
      name: 'Masjid',
      width: 'w-[50%]',
      render: (_, item) => <MasjidCell masjid={item} />,
    },
    {
      key: 'submitted',
      name: 'Waiting',
      width: 'w-[25%]',
      render: (_, item) =>
        item.verification?.submitted_at && (
          <span title={format(new Date(item.verification.submitted_at), 'PPpp')}>
            {formatDistanceToNowStrict(new Date(item.verification.submitted_at))}
          </span>
        ),
    },
    {
      key: 'grace',
      name: 'Grace ends',
      width: 'w-[25%]',
      render: (_, item) =>
        item.verification?.grace_until
          ? format(new Date(item.verification.grace_until), 'd MMM yyyy')
          : '—',
    },
  ];

  const certificateColumns: Column<PendingTaxExemption>[] = [
    {
      key: 'masjid',
      name: 'Masjid',
      width: 'w-[50%]',
      render: (_, item) => item.masjid && <MasjidCell masjid={item.masjid} />,
    },
    {
      key: 'state',
      name: 'State',
      width: 'w-[25%]',
      render: (_, item) => usStateName(item.state),
    },
    {
      key: 'created_at',
      name: 'Waiting',
      width: 'w-[25%]',
      render: value => (
        <span title={format(new Date(value as string), 'PPpp')}>
          {formatDistanceToNowStrict(new Date(value as string))}
        </span>
      ),
    },
  ];

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Review queue'
        description='Masjids waiting for verification and tax-exemption certificates waiting for a decision, longest waiting first'
        showAddButton={false}
      />
      <ErrorAlert message={error} onClose={() => setError(null)} />
      <Card>
        <CardContent>
          {queue === null ? (
            <div className='animate-pulse bg-muted rounded-lg h-48' />
          ) : queue.length === 0 ? (
            <EmptyState
              icon={<Inbox className='h-6 w-6 text-muted-foreground' />}
              title='Nothing to review'
              description='New submissions appear here.'
            />
          ) : (
            <DataTable
              columns={columns}
              data={queue}
              keyField='id'
              onRowClick={item => navigate(PlatformRoutes.Masjid.replace(':id', item.id))}
            />
          )}
        </CardContent>
      </Card>

      <div className='space-y-2'>
        <h2 className='text-lg font-semibold'>Tax-exemption certificates</h2>
        <p className='text-sm text-muted-foreground'>
          Nonprofit sales tax certificates waiting for a decision, longest waiting first. Decide
          them on the masjid's page.
        </p>
      </div>
      <Card>
        <CardContent>
          {certificates === null ? (
            <div className='animate-pulse bg-muted rounded-lg h-24' />
          ) : certificates.length === 0 ? (
            <EmptyState
              icon={<Inbox className='h-6 w-6 text-muted-foreground' />}
              title='No certificates to review'
              description='New certificates appear here.'
            />
          ) : (
            <DataTable
              columns={certificateColumns}
              data={certificates}
              keyField='id'
              onRowClick={item => navigate(PlatformRoutes.Masjid.replace(':id', item.masjid_id))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
