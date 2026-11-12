import { useEffect, useState } from 'react';
import {
  getScreens,
  deleteScreen,
  keepScreenLive,
  type DisplayScreenWithHeartbeat,
} from '@/lib/supabase';
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
  ProFeatureNotice,
  type Column,
} from '@/components/common';
import { Monitor, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { usePlan, useTrigger } from '@/hooks';
import { showSaveError } from '@/lib/save-error';
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
  const { plan, screenLimit } = usePlan();
  const [keepingLive, setKeepingLive] = useState<string | null>(null);

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

  const atLimit = screenLimit !== null && !loading && screens.length >= screenLimit;
  const pausedCount = screens.filter(screen => screen.paused_at).length;

  const handleKeepLive = async (screen: DisplayScreen) => {
    try {
      setKeepingLive(screen.id);
      await keepScreenLive(screen.id);
      toast.success(`${screen.name} is live`);
      forceUpdate();
    } catch (err) {
      showSaveError(err, 'Failed to change which screens are live');
    } finally {
      setKeepingLive(null);
    }
  };

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
      render: (value, item) => (
        <span className='flex flex-wrap items-center gap-2'>
          <span className='font-medium'>{value as string}</span>
          {item.paused_at && (
            <Badge
              variant='outline'
              className='border-amber-400 text-amber-700 dark:text-amber-300'
            >
              Paused
            </Badge>
          )}
        </span>
      ),
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
      card: 'meta',
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
    <div className='container mx-auto pb-2 md:pb-8 space-y-6'>
      <PageHeader
        title='Display Screens'
        description='Create and manage display screens for different areas of your masjid'
        onAddClick={handleAddNew}
        addButtonText='Add Screen'
        addButtonDisabled={atLimit}
      />

      {atLimit && pausedCount === 0 && (
        <ProFeatureNotice>
          {plan === 'free' ? (
            <p>The Free plan includes 1 screen. Upgrade to Pro for up to 5, and more if needed.</p>
          ) : (
            <p>
              The masjid's plan has {screenLimit} screens and all are in use. Add more screens from
              Manage billing on the Billing page.
            </p>
          )}
        </ProFeatureNotice>
      )}

      {pausedCount > 0 && (
        <ProFeatureNotice>
          <p className='font-medium'>
            {pausedCount === 1 ? '1 screen is paused' : `${pausedCount} screens are paused`}
          </p>
          <p>
            The masjid has more screens than its plan includes ({screenLimit}), so the rest show
            "This screen isn't active". Nothing is lost. Choose Keep live on a paused screen to swap
            it in, or upgrade to bring them all back.
          </p>
        </ProFeatureNotice>
      )}

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
          actionsWidth={pausedCount > 0 ? 'w-[18%]' : 'w-[8%]'}
          onRowClick={item => navigate(`/admin/screens/${item.id}`)}
          renderActions={item => (
            <div className='flex items-center justify-end gap-1'>
              {item.paused_at && (
                <Button
                  variant='outline'
                  size='sm'
                  loading={keepingLive === item.id}
                  disabled={keepingLive !== null}
                  onClick={e => {
                    e.stopPropagation();
                    void handleKeepLive(item);
                  }}
                >
                  Keep live
                </Button>
              )}
              <ActionButtons
                onGoto={() => navigate(`/admin/screens/${item.id}`)}
                onDelete={() => handleDeleteClick(item)}
              />
            </div>
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
