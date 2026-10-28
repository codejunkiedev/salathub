import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import {
  getScreenById,
  getScreenContentWithDetails,
  updateScreenContentOrder,
  unassignScreenContent,
  deleteScreen,
  type ScreenContentWithDetails,
} from '@/lib/supabase';
import type { DisplayScreen } from '@/types';
import { Badge, Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import {
  PageHeader,
  ErrorAlert,
  EmptyState,
  DataTable,
  OrientationBadge,
  type Column,
} from '@/components/common';
import { ThemeSection } from '@/components/settings';
import { ScreenModal, DeleteConfirmationModal } from '@/components/modals';
import { ArrowLeft, Monitor, Copy, Check, Pencil, Trash2, Unlink } from 'lucide-react';
import { AppRoutes } from '@/constants';
import { useTrigger } from '@/hooks';
import { toast } from 'sonner';

const CONTENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  announcements: { label: 'Announcement', color: 'bg-amber-600 text-white' },
  events: { label: 'Event', color: 'bg-emerald-600 text-white' },
  posts: { label: 'Post', color: 'bg-purple-600 text-white' },
  youtube_videos: { label: 'YouTube Video', color: 'bg-red-600 text-white' },
  ayat_and_hadith: { label: 'Ayat / Hadith', color: 'bg-sky-600 text-white' },
};

export default function ScreenDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<DisplayScreen | null>(null);
  const [content, setContent] = useState<ScreenContentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToUnassign, setItemToUnassign] = useState<ScreenContentWithDetails | null>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);

  const [trigger, forceUpdate] = useTrigger();

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [screenData, contentData] = await Promise.all([
          getScreenById(id),
          getScreenContentWithDetails(id),
        ]);
        setScreen(screenData);
        setContent(contentData);
      } catch (err) {
        setError('Failed to load screen details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, trigger]);

  const handleOrderChange = async (items: ScreenContentWithDetails[]) => {
    if (isUpdatingOrder) return;

    setContent(items);

    try {
      setIsUpdatingOrder(true);
      const updates = items.map((item, index) => ({
        id: item.id,
        display_order: index + 1,
      }));
      await updateScreenContentOrder(updates);
      toast.success('Order updated');
    } catch (err) {
      console.error('Error updating order:', err);
      toast.error('Failed to update order');
      forceUpdate();
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleUnassignConfirm = async () => {
    if (!itemToUnassign) return;

    try {
      setIsUnassigning(true);
      await unassignScreenContent(itemToUnassign.id);
      setContent(prev => prev.filter(c => c.id !== itemToUnassign.id));
      setItemToUnassign(null);
      toast.success('Removed from this screen');
    } catch (err) {
      console.error('Error unassigning content:', err);
      toast.error('Failed to remove from this screen, please try again.');
    } finally {
      setIsUnassigning(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!screen) return;

    try {
      setIsDeleting(true);
      await deleteScreen(screen.id);
      toast.success('Screen deleted successfully');
      navigate(AppRoutes.Screens);
    } catch (err) {
      console.error('Error deleting screen:', err);
      setError('Failed to delete screen. Please try again.');
      toast.error('Failed to delete screen, please try again.');
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!screen?.code) return;
    try {
      await navigator.clipboard.writeText(screen.code);
      setCopiedCode(true);
      toast.success('Screen code copied');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const columns: Column<ScreenContentWithDetails>[] = [
    {
      key: 'title',
      name: 'Content',
      width: 'w-[70%]',
      render: (_, item) => {
        const showDescription = item.title !== item.description && item.description;
        return (
          <div>
            <div className='flex items-center gap-2'>
              <div className='font-medium whitespace-pre-wrap line-clamp-1 overflow-hidden'>
                {item.title}
              </div>
              {!item.published && <Badge variant='secondary'>Draft</Badge>}
            </div>
            {showDescription && (
              <div className='text-muted-foreground text-xs whitespace-pre-wrap line-clamp-1 overflow-hidden mt-0.5'>
                {item.description}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'content_type',
      name: 'Type',
      width: 'w-[15%]',
      render: value => {
        const config = CONTENT_TYPE_CONFIG[value as string];
        return <Badge className={config?.color || ''}>{config?.label || (value as string)}</Badge>;
      },
    },
  ];

  if (loading) {
    return (
      <div className='container mx-auto py-8 space-y-6'>
        <div className='animate-pulse bg-muted rounded-lg h-12 w-48' />
        <div className='animate-pulse bg-muted rounded-lg h-32' />
        <div className='animate-pulse bg-muted rounded-lg h-64' />
      </div>
    );
  }

  if (!screen) {
    return (
      <div className='container mx-auto py-8 space-y-6'>
        <ErrorAlert message='Screen not found' onClose={() => {}} />
      </div>
    );
  }

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <div className='flex items-center gap-4'>
        <Link to={AppRoutes.Screens}>
          <Button variant='ghost' size='sm'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Screens
          </Button>
        </Link>
      </div>

      <PageHeader
        title={screen.name}
        description='Manage content assigned to this screen. Drag to reorder. Drafts stay off the screen until published.'
        showAddButton={false}
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      <Card>
        <CardHeader>
          <div className='flex justify-between items-center'>
            <CardTitle className='text-base'>Screen Info</CardTitle>
            <div className='flex items-center gap-2'>
              <Button variant='outline' size='sm' onClick={() => setIsEditModalOpen(true)}>
                <Pencil className='h-4 w-4 mr-2' />
                Edit
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsDeleteDialogOpen(true)}
                className='text-destructive hover:bg-destructive/10 hover:text-destructive'
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
            <div>
              <span className='text-muted-foreground block'>Code</span>
              <div className='flex items-center gap-2 mt-1'>
                <code className='bg-muted px-2 py-0.5 rounded'>{screen.code}</code>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-6 w-6'
                  onClick={handleCopyCode}
                  title='Copy code'
                >
                  {copiedCode ? <Check size={14} className='text-green-500' /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
            <div>
              <span className='text-muted-foreground block'>Orientation</span>
              <div className='mt-1'>
                <OrientationBadge orientation={screen.orientation} />
              </div>
            </div>
            <div>
              <span className='text-muted-foreground block'>Prayer Times</span>
              <Badge variant={screen.show_prayer_times ? 'default' : 'secondary'} className='mt-1'>
                {screen.show_prayer_times ? 'Shown' : 'Hidden'}
              </Badge>
            </div>
            <div>
              <span className='text-muted-foreground block'>Weather</span>
              <Badge variant={screen.show_weather ? 'default' : 'secondary'} className='mt-1'>
                {screen.show_weather ? 'Shown' : 'Hidden'}
              </Badge>
            </div>
            <div>
              <span className='text-muted-foreground block'>Follow QR</span>
              <Badge variant={screen.show_follow_qr ? 'default' : 'secondary'} className='mt-1'>
                {screen.show_follow_qr ? 'Shown' : 'Hidden'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {screen.show_prayer_times && <ThemeSection screen={screen} onScreenChange={setScreen} />}

      {content.length === 0 ? (
        <EmptyState
          icon={<Monitor className='h-6 w-6 text-muted-foreground' />}
          title='No content assigned'
          description='Assign content to this screen from the Announcements, Events, Posts, YouTube Videos, or Ayat & Hadith pages.'
        />
      ) : (
        <DataTable
          columns={columns}
          data={content}
          keyField='id'
          showRowNumbers={true}
          isDraggable={true}
          onOrderChange={handleOrderChange}
          rowClassName={item => (item.published ? '' : 'opacity-60')}
          actionsWidth='w-[15%]'
          renderActions={item => (
            <div className='flex justify-center'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setItemToUnassign(item)}
                className='text-destructive hover:bg-destructive/10 hover:text-destructive'
              >
                <Unlink className='h-4 w-4 mr-2' />
                Unassign
              </Button>
            </div>
          )}
        />
      )}

      <ScreenModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={forceUpdate}
        initialData={screen}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        itemType='screen'
        itemTitle={screen.name}
        itemSubtitle={screen.code}
      />

      <DeleteConfirmationModal
        isOpen={!!itemToUnassign}
        onClose={() => setItemToUnassign(null)}
        onConfirm={handleUnassignConfirm}
        isDeleting={isUnassigning}
        title='Unassign from screen'
        description={`Remove this item from ${screen.name}? It stays in your content and can be assigned again.`}
        confirmLabel='Unassign'
        itemTitle={itemToUnassign?.title}
        itemSubtitle={
          itemToUnassign ? CONTENT_TYPE_CONFIG[itemToUnassign.content_type]?.label : undefined
        }
      />
    </div>
  );
}
