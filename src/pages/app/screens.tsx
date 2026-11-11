import { useEffect, useState } from 'react';
import { getScreens, deleteScreen, type DisplayScreenWithHeartbeat } from '@/lib/supabase';
import type { DisplayScreen } from '@/types';
import { Badge, Button } from '@/components/ui';
import { TableSkeleton } from '@/components/skeletons';
import { ScreenModal, DeleteConfirmationModal } from '@/components/modals';
import {
  PageHeader,
  ErrorAlert,
  EmptyState,
  ActionButtons,
  DataTable,
  OrientationBadge,
  type Column,
} from '@/components/common';
import { Monitor, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { useTrigger } from '@/hooks';
import { toast } from 'sonner';

export default function Screens() {
  const [screens, setScreens] = useState<DisplayScreenWithHeartbeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DisplayScreen | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [trigger, forceUpdate] = useTrigger();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getScreens();
        setScreens(data);
      } catch (err) {
        setError('Failed to fetch screens');
        toast.error('Failed to fetch screens');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trigger]);

  const handleAddNew = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleDeleteClick = (item: DisplayScreen) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      await deleteScreen(itemToDelete.id);
      forceUpdate();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast.success('Screen deleted successfully');
    } catch (err) {
      console.error('Error deleting screen:', err);
      setError('Failed to delete screen. Please try again.');
      toast.error('Failed to delete screen, please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Screen code copied to clipboard');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const columns: Column<DisplayScreenWithHeartbeat>[] = [
    {
      key: 'name',
      name: 'Name',
      width: 'w-[22%]',
      render: value => <span className='font-medium'>{value as string}</span>,
    },
    {
      key: 'code',
      name: 'Code',
      width: 'w-[16%]',
      render: value => (
        <div className='flex items-center gap-2'>
          <code className='text-sm bg-muted px-2 py-0.5 rounded'>{value as string}</code>
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6'
            onClick={e => {
              e.stopPropagation();
              handleCopyCode(value as string);
            }}
            title='Copy code'
          >
            {copiedCode === value ? (
              <Check size={14} className='text-green-500' />
            ) : (
              <Copy size={14} />
            )}
          </Button>
        </div>
      ),
    },
    {
      key: 'orientation',
      name: 'Orientation',
      width: 'w-[12%]',
      render: value => <OrientationBadge orientation={value as DisplayScreen['orientation']} />,
    },
    {
      key: 'slide_interval_seconds',
      name: 'Interval',
      width: 'w-[8%]',
      render: value => <span className='text-sm'>{(value as number) ?? 5}s</span>,
    },
    {
      key: 'show_prayer_times',
      name: 'Prayer Times',
      width: 'w-[12%]',
      render: value => (
        <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>
      ),
    },
    {
      key: 'show_weather',
      name: 'Weather',
      width: 'w-[12%]',
      render: value => (
        <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Yes' : 'No'}</Badge>
      ),
    },
    {
      key: 'last_seen_at',
      name: 'Last Seen',
      width: 'w-[14%]',
      render: value =>
        value ? (
          <span className='text-sm text-muted-foreground'>
            {formatDistanceToNow(new Date(value as string), { addSuffix: true })}
          </span>
        ) : (
          <span className='text-sm text-muted-foreground italic'>Never</span>
        ),
    },
  ];

  return (
    <div className='container mx-auto py-2 md:py-8 space-y-6'>
      <PageHeader
        title='Display Screens'
        description='Create and manage display screens for different areas of your masjid'
        onAddClick={handleAddNew}
        addButtonText='Add Screen'
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <TableSkeleton columns={columns} showRowNumbers={true} />
      ) : screens.length === 0 ? (
        <EmptyState
          icon={<Monitor className='h-6 w-6 text-muted-foreground' />}
          title='No screens found'
          description="You haven't created any display screens yet. Create your first one to get started."
          actionText='Add First Screen'
          onActionClick={handleAddNew}
        />
      ) : (
        <DataTable
          columns={columns}
          data={screens}
          keyField='id'
          showRowNumbers={true}
          actionsWidth='w-[8%]'
          onRowClick={item => navigate(`/admin/screens/${item.id}`)}
          renderActions={item => (
            <ActionButtons
              onGoto={() => navigate(`/admin/screens/${item.id}`)}
              onDelete={() => handleDeleteClick(item)}
            />
          )}
        />
      )}

      <ScreenModal isOpen={isModalOpen} onClose={handleModalClose} onSuccess={forceUpdate} />

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        itemType='screen'
        itemTitle={itemToDelete?.name}
        itemSubtitle={itemToDelete?.code}
      />
    </div>
  );
}
