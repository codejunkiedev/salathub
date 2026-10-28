import { useEffect, useState } from 'react';
import { getAnnouncements, deleteAnnouncement } from '@/lib/supabase';
import type { Announcement } from '@/types';
import { TableSkeleton } from '@/components/skeletons';
import {
  AnnouncementModal,
  DeleteConfirmationModal,
  ScreenAssignmentModal,
} from '@/components/modals';
import {
  PageHeader,
  ErrorAlert,
  EmptyState,
  ActionButtons,
  DataTable,
  PublishStatusBadge,
  type Column,
} from '@/components/common';
import { Bell } from 'lucide-react';
import { useTrigger, usePublishToggle } from '@/hooks';
import { toast } from 'sonner';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Announcement | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [screenAssignItem, setScreenAssignItem] = useState<Announcement | null>(null);
  const [assignedFromCreate, setAssignedFromCreate] = useState(false);

  const [trigger, forceUpdate] = useTrigger();
  const togglePublish = usePublishToggle('announcements', forceUpdate);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getAnnouncements();
        setAnnouncements(data);
      } catch (err) {
        setError('Failed to fetch announcements');
        toast.error('Failed to fetch announcements');
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

  const handleEdit = (item: Announcement) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedItem(undefined);
  };

  const handleDeleteClick = (item: Announcement) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      await deleteAnnouncement(itemToDelete.id);
      forceUpdate();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast.success('Announcement deleted successfully');
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete announcement. Please try again.');
      toast.error('Failed to delete announcement, please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const columns: Column<Announcement>[] = [
    {
      key: 'title',
      name: 'Title',
      width: 'w-[28%]',
      render: value => <div className='line-clamp-1'>{(value as string | null) || '—'}</div>,
    },
    {
      key: 'description',
      name: 'Description',
      width: 'w-[46%]',
      render: value => (
        <div className='whitespace-pre-wrap line-clamp-1 overflow-hidden'>{value as string}</div>
      ),
    },
    {
      key: 'published_at',
      name: 'Status',
      width: 'w-[12%]',
      render: value => <PublishStatusBadge published={value !== null} />,
    },
  ];

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <PageHeader
        title='Announcements'
        description='Manage your masjid announcements'
        onAddClick={handleAddNew}
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {loading ? (
        <TableSkeleton columns={columns} showRowNumbers={true} />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={<Bell className='h-6 w-6 text-muted-foreground' />}
          title='No announcements found'
          description="You haven't added any announcements yet. Add your first one to get started."
          actionText='Add First Announcement'
          onActionClick={handleAddNew}
        />
      ) : (
        <DataTable
          columns={columns}
          data={announcements}
          keyField='id'
          showRowNumbers={true}
          actionsWidth='w-[14%]'
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

      <AnnouncementModal
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
        itemType='announcement'
        itemTitle={itemToDelete?.title || itemToDelete?.description}
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
          contentType='announcements'
          contentLabel={screenAssignItem.title || screenAssignItem.description}
          dismissLabel={assignedFromCreate ? 'Skip' : 'Cancel'}
        />
      )}
    </div>
  );
}
