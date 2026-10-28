import { useEffect, useState } from 'react';
import { getYouTubeVideos, deleteYouTubeVideo } from '@/lib/supabase';
import type { YouTubeVideo } from '@/types';
import { TableSkeleton } from '@/components/skeletons';
import {
  YouTubeVideoModal,
  DeleteConfirmationModal,
  ScreenAssignmentModal,
} from '@/components/modals';
import {
  PageHeader,
  ErrorAlert,
  EmptyState,
  ActionButtons,
  DataTable,
  ContentStatus,
  type Column,
} from '@/components/common';
import { Video, Repeat } from 'lucide-react';
import { useTrigger, usePublishToggle } from '@/hooks';
import { Badge } from '@/components/ui';
import { toast } from 'sonner';

export default function YouTubeVideos() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<YouTubeVideo | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<YouTubeVideo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [screenAssignItem, setScreenAssignItem] = useState<YouTubeVideo | null>(null);
  const [assignedFromCreate, setAssignedFromCreate] = useState(false);

  const [trigger, forceUpdate] = useTrigger();
  const togglePublish = usePublishToggle('youtube_videos', forceUpdate);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getYouTubeVideos();
        setVideos(data);
      } catch (err) {
        setError('Failed to fetch YouTube videos');
        toast.error('Failed to fetch YouTube videos');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trigger]);

  const handleAddNew = () => {
    setSelectedItem(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (item: YouTubeVideo) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedItem(undefined);
  };

  const handleDeleteClick = (item: YouTubeVideo) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      await deleteYouTubeVideo(itemToDelete.id);
      forceUpdate();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast.success('YouTube video deleted successfully');
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete YouTube video. Please try again.');
      toast.error('Failed to delete YouTube video, please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const columns: Column<YouTubeVideo>[] = [
    {
      key: 'title',
      name: 'Title',
      width: 'w-[25%]',
      render: value => (
        <div className='whitespace-pre-wrap line-clamp-1 overflow-hidden font-medium'>
          {value as string}
        </div>
      ),
    },
    {
      key: 'youtube_url',
      name: 'URL',
      width: 'w-[37%]',
      render: value => (
        <div className='whitespace-pre-wrap line-clamp-1 overflow-hidden text-muted-foreground text-sm'>
          {value as string}
        </div>
      ),
    },
    {
      key: 'loop_video',
      name: 'Loop',
      width: 'w-[10%]',
      render: value => (
        <Badge variant={value ? 'default' : 'secondary'} className='gap-1'>
          <Repeat className='w-3 h-3' />
          {value ? 'On' : 'Off'}
        </Badge>
      ),
    },
    {
      key: 'published_at',
      name: 'Status',
      width: 'w-[90px]',
      render: value => <ContentStatus published={value !== null} />,
    },
  ];

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <PageHeader
        title='YouTube Videos'
        description='Manage YouTube video slides for your screens'
        onAddClick={handleAddNew}
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <TableSkeleton columns={columns} showRowNumbers={true} />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Video className='h-6 w-6 text-muted-foreground' />}
          title='No YouTube videos found'
          description="You haven't added any YouTube videos yet. Add your first one to get started."
          actionText='Add First Video'
          onActionClick={handleAddNew}
        />
      ) : (
        <DataTable
          columns={columns}
          data={videos}
          keyField='id'
          showRowNumbers={true}
          actionsWidth='w-[16%]'
          renderActions={item => (
            <ActionButtons
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDeleteClick(item)}
              onScreens={() => setScreenAssignItem(item)}
              onTogglePublish={() => togglePublish(item)}
              published={item.published_at !== null}
            />
          )}
        />
      )}

      <YouTubeVideoModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={created => {
          if (created) {
            setAssignedFromCreate(true);
            setScreenAssignItem(created);
          } else {
            forceUpdate();
          }
        }}
        initialData={selectedItem}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        itemType='YouTube video'
        itemTitle={itemToDelete?.title}
      />

      {screenAssignItem && (
        <ScreenAssignmentModal
          isOpen={!!screenAssignItem}
          onClose={() => {
            setScreenAssignItem(null);
            if (assignedFromCreate) {
              forceUpdate();
              setAssignedFromCreate(false);
            }
          }}
          contentId={screenAssignItem.id}
          isDraft={screenAssignItem.published_at === null}
          contentType='youtube_videos'
          contentLabel={screenAssignItem.title}
          dismissLabel={assignedFromCreate ? 'Skip' : 'Cancel'}
        />
      )}
    </div>
  );
}
