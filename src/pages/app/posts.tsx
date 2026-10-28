import { useEffect, useState } from 'react';
import { getPosts, deletePost } from '@/lib/supabase';
import type { Post, PostOrientation } from '@/types';
import { TableSkeleton } from '@/components/skeletons';
import {
  PostModal,
  DeleteConfirmationModal,
  OrientationPickerModal,
  ScreenAssignmentModal,
} from '@/components/modals';
import {
  PageHeader,
  ErrorAlert,
  EmptyState,
  ActionButtons,
  DataTable,
  OrientationBadge,
  ContentStatus,
  type Column,
} from '@/components/common';
import { FileImage } from 'lucide-react';
import { useTrigger, usePublishToggle } from '@/hooks';
import { Popover, PopoverContent, PopoverTrigger, RemoteImage } from '@/components/ui';
import { toast } from 'sonner';

const POST_ORIENTATIONS = ['landscape', 'portrait'] as const;

export default function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Post | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [screenAssignItem, setScreenAssignItem] = useState<Post | null>(null);
  const [assignedFromCreate, setAssignedFromCreate] = useState(false);
  const [orientationPickerOpen, setOrientationPickerOpen] = useState(false);
  const [pendingOrientation, setPendingOrientation] = useState<PostOrientation | null>(null);

  const [trigger, forceUpdate] = useTrigger();
  const togglePublish = usePublishToggle('posts', forceUpdate);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getPosts();
        setPosts(data);
      } catch (err) {
        setError('Failed to fetch posts');
        toast.error('Failed to fetch posts');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trigger]);

  const handleAddNew = () => {
    setSelectedItem(undefined);
    setOrientationPickerOpen(true);
  };

  const handleOrientationContinue = (orientation: PostOrientation) => {
    setPendingOrientation(orientation);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Post) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedItem(undefined);
    setPendingOrientation(null);
  };

  const handleDeleteClick = (item: Post) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      await deletePost(itemToDelete.id);
      forceUpdate();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast.success('Post deleted successfully');
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete post. Please try again.');
      toast.error('Failed to delete post, please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const columns: Column<Post>[] = [
    {
      key: 'image_url',
      name: 'Preview',
      width: 'w-[120px]',
      render: value =>
        value ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type='button' className='cursor-zoom-in'>
                <RemoteImage
                  src={value as string}
                  alt='Post preview'
                  containerClassName='h-14 w-24 rounded border'
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className='p-0 border-0 bg-transparent shadow-none'
              style={{ width: 'auto' }}
              side='right'
              align='start'
              collisionPadding={16}
            >
              <img
                src={value as string}
                alt='Post enlarged'
                style={{ maxHeight: '60vh', maxWidth: 'min(85vw, 300px)', display: 'block' }}
                className='object-contain rounded-md shadow-lg'
              />
            </PopoverContent>
          </Popover>
        ) : (
          <div className='h-14 w-24 bg-muted flex items-center justify-center rounded border'>
            <FileImage className='w-6 h-6 text-muted-foreground' />
          </div>
        ),
    },
    {
      key: 'title',
      name: 'Title',
      width: 'w-[50%]',
      render: value => (
        <div className='whitespace-pre-wrap line-clamp-1 overflow-hidden font-medium'>
          {value as string}
        </div>
      ),
    },
    {
      key: 'orientation',
      name: 'Orientation',
      width: 'w-[120px]',
      render: (_value, item) => <OrientationBadge orientation={(item as Post).orientation} />,
    },
    {
      key: 'published_at',
      name: 'Status',
      width: 'w-[90px]',
      render: (value, item) => (
        <ContentStatus published={value !== null} showInApp={item.show_in_app} />
      ),
    },
  ];

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <PageHeader title='Posts' description='Manage your masjid posts' onAddClick={handleAddNew} />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <TableSkeleton columns={columns} showRowNumbers={true} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<FileImage className='h-6 w-6 text-muted-foreground' />}
          title='No posts found'
          description="You haven't added any posts yet. Add your first one to get started."
          actionText='Add First Post'
          onActionClick={handleAddNew}
        />
      ) : (
        <DataTable
          columns={columns}
          data={posts}
          keyField='id'
          showRowNumbers={true}
          actionsWidth='w-[14%]'
          renderActions={item => (
            <ActionButtons
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDeleteClick(item)}
              onScreens={() => setScreenAssignItem(item)}
              screensLabel='Where to show'
              onTogglePublish={() => togglePublish(item)}
              published={item.published_at !== null}
            />
          )}
        />
      )}

      <PostModal
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
        presetOrientation={pendingOrientation ?? undefined}
      />

      <OrientationPickerModal
        open={orientationPickerOpen}
        onOpenChange={setOrientationPickerOpen}
        title='New Post'
        itemLabel='post'
        orientations={POST_ORIENTATIONS}
        onSelect={handleOrientationContinue}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        itemType='post'
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
          showInApp={screenAssignItem.show_in_app}
          onSaved={forceUpdate}
          contentType='posts'
          contentLabel={screenAssignItem.title}
          contentOrientation={screenAssignItem.orientation}
          dismissLabel={assignedFromCreate ? 'Skip' : 'Cancel'}
        />
      )}
    </div>
  );
}
