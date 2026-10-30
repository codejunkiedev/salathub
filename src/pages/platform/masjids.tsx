import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { DataTable, ErrorAlert, PageHeader, type Column } from '@/components/common';
import { MasjidCell, VerificationStatusBadge } from '@/components/platform';
import { getPlatformMasjids } from '@/lib/supabase';
import { PlatformRoutes } from '@/constants';
import type { PlatformMasjid } from '@/types';
import { cn } from '@/utils';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'not_submitted', label: 'Not submitted' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

const matchesFilter = (masjid: PlatformMasjid, filter: FilterKey) => {
  const v = masjid.verification;
  if (filter === 'all') return true;
  if (filter === 'suspended') return !!v?.suspended_at;
  return !v?.suspended_at && v?.status === filter;
};

export default function PlatformMasjids() {
  const navigate = useNavigate();
  const [masjids, setMasjids] = useState<PlatformMasjid[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getPlatformMasjids()
      .then(setMasjids)
      .catch(err => {
        console.error(err);
        setError('Failed to load masjids');
        setMasjids([]);
      });
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (masjids ?? []).filter(
      m =>
        matchesFilter(m, filter) &&
        (!term || m.name.toLowerCase().includes(term) || m.area?.toLowerCase().includes(term))
    );
  }, [masjids, filter, search]);

  const columns: Column<PlatformMasjid>[] = [
    {
      key: 'name',
      name: 'Masjid',
      width: 'w-[40%]',
      render: (_, item) => <MasjidCell masjid={item} />,
    },
    {
      key: 'status',
      name: 'Verification',
      width: 'w-[20%]',
      render: (_, item) => <VerificationStatusBadge verification={item.verification} />,
    },
    {
      key: 'in_app',
      name: 'In the app',
      width: 'w-[20%]',
      render: (_, item) => (item.in_app ? 'Yes' : item.listed ? 'Listed, hidden' : 'No'),
    },
    {
      key: 'created_at',
      name: 'Joined',
      width: 'w-[20%]',
      render: value => format(new Date(value as string), 'd MMM yyyy'),
    },
  ];

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Masjids'
        description='Every masjid on SalatHub with its verification and app status'
        showAddButton={false}
      />
      <ErrorAlert message={error} onClose={() => setError(null)} />
      <div className='flex flex-col gap-3 md:flex-row md:items-center'>
        <div className='relative md:w-72'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search by name or area'
            className='pl-9'
          />
        </div>
        <div className='flex flex-wrap gap-1'>
          {FILTERS.map(f => (
            <Button
              key={f.key}
              size='sm'
              variant='ghost'
              className={cn(filter === f.key && 'bg-accent text-accent-foreground')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>
      <Card>
        <CardContent>
          {masjids === null ? (
            <div className='animate-pulse bg-muted rounded-lg h-48' />
          ) : visible.length === 0 ? (
            <p className='py-8 text-center text-sm text-muted-foreground'>No masjids match.</p>
          ) : (
            <DataTable
              columns={columns}
              data={visible}
              keyField='id'
              onRowClick={item => navigate(PlatformRoutes.Masjid.replace(':id', item.id))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
