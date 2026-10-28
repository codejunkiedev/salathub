import { useEffect, useState } from 'react';
import { getEvents, deleteEvent, type EventScope } from '@/lib/supabase';
import type { Event } from '@/types';
import { TableSkeleton } from '@/components/skeletons';
import { EventModal, DeleteConfirmationModal, ScreenAssignmentModal } from '@/components/modals';
import {
  PageHeader,
  ErrorAlert,
  EmptyState,
  ActionButtons,
  DataTable,
  PublishStatusBadge,
  type Column,
} from '@/components/common';
import { Calendar } from 'lucide-react';
import { useTrigger, useMasjidTimezone, usePublishToggle } from '@/hooks';
import { describeTimeZone, formatZonedDateTime } from '@/utils';
import { Button } from '@/components/ui';
import { toast } from 'sonner';

const SCOPES: { value: EventScope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
];

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Event | undefined>(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [screenAssignItem, setScreenAssignItem] = useState<Event | null>(null);
  const [assignedFromCreate, setAssignedFromCreate] = useState(false);
  const [scope, setScope] = useState<EventScope>('upcoming');

  const { timeZone, isLoading: isTimezoneLoading } = useMasjidTimezone();
  const [trigger, forceUpdate] = useTrigger();
  const togglePublish = usePublishToggle('events', forceUpdate);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getEvents(undefined, scope);
        setEvents(data);
      } catch (err) {
        setError('Failed to fetch events');
        toast.error('Failed to fetch events');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trigger, scope]);

  const handleAddNew = () => {
    setSelectedItem(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Event) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedItem(undefined);
  };

  const handleDeleteClick = (item: Event) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      setIsDeleting(true);
      await deleteEvent(itemToDelete.id);
      forceUpdate();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      toast.success('Event deleted successfully');
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete event. Please try again.');
      toast.error('Failed to delete event, please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const columns: Column<Event>[] = [
    {
      key: 'title',
      name: 'Title',
      width: 'w-[20%]',
      render: value => (
        <div className='whitespace-pre-wrap line-clamp-1 overflow-hidden font-medium'>
          {value as string}
        </div>
      ),
    },
    {
      key: 'description',
      name: 'Description',
      width: 'w-[26%]',
      render: value => (
        <div className='whitespace-pre-wrap line-clamp-1 overflow-hidden'>{value as string}</div>
      ),
    },
    {
      key: 'date_time',
      name: 'Date & Time',
      width: 'w-[18%]',
      render: (value, item) => (
        <div>
          <div>{formatZonedDateTime(value as string, timeZone)}</div>
          {item.end_time && (
            <div className='text-xs text-muted-foreground'>
              until {formatZonedDateTime(item.end_time, timeZone)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      name: 'Location',
      width: 'w-[14%]',
    },
    {
      key: 'published_at',
      name: 'Status',
      width: 'w-[10%]',
      render: value => <PublishStatusBadge published={value !== null} />,
    },
  ];

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <PageHeader
        title='Events'
        description={
          isTimezoneLoading
            ? 'Manage your masjid events and programs'
            : `Manage your masjid events and programs. Times are in ${describeTimeZone(timeZone)}.`
        }
        onAddClick={handleAddNew}
        addButtonDisabled={isTimezoneLoading}
        actions={
          <div className='flex gap-1'>
            {SCOPES.map(option => (
              <Button
                key={option.value}
                variant={scope === option.value ? 'default' : 'outline'}
                onClick={() => setScope(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        }
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {loading || isTimezoneLoading ? (
        <TableSkeleton columns={columns} showRowNumbers={true} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Calendar className='h-6 w-6 text-muted-foreground' />}
          title={scope === 'upcoming' ? 'No upcoming events' : 'No events found'}
          description={
            scope === 'upcoming'
              ? 'Nothing is coming up. Add an event, or switch to Past to see ones that have finished.'
              : "You haven't added any events yet. Add your first one to get started."
          }
          actionText='Add First Event'
          onActionClick={handleAddNew}
        />
      ) : (
        <DataTable
          columns={columns}
          data={events}
          keyField='id'
          showRowNumbers={true}
          actionsWidth='w-[12%]'
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

      <EventModal
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
        timeZone={timeZone}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        itemType='event'
        itemTitle={itemToDelete?.title}
        itemSubtitle={formatZonedDateTime(itemToDelete?.date_time, timeZone)}
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
          contentType='events'
          contentLabel={screenAssignItem.title}
          dismissLabel={assignedFromCreate ? 'Skip' : 'Cancel'}
        />
      )}
    </div>
  );
}
