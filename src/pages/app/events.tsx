import { useEffect, useState } from 'react';
import { getEvents, deleteEvent, type EventScope, getContentIdsOnScreens } from '@/lib/supabase';
import type { Event } from '@/types';
import { TableSkeleton } from '@/components/skeletons';
import { EventModal, DeleteConfirmationModal, ScreenAssignmentModal } from '@/components/modals';
import {
  PageHeader,
  ErrorAlert,
  EmptyState,
  ActionButtons,
  DataTable,
  ContentStatus,
  type Column,
} from '@/components/common';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { useTrigger, useMasjidTimezone, usePublishToggle } from '@/hooks';
import { describeTimeZone, formatZoned, formatZonedDateTime } from '@/utils';
import { Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { toast } from 'sonner';

const SCOPES: { value: EventScope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
];

export default function Events() {
  const [events, setEvents] = useState<Event[]>([]);
  const [onScreenIds, setOnScreenIds] = useState<Set<string>>(new Set());
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
        const [data, screenIds] = await Promise.all([
          getEvents(undefined, scope),
          getContentIdsOnScreens('events'),
        ]);
        setEvents(data);
        setOnScreenIds(screenIds);
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
      card: 'body',
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
      card: 'meta',
      width: 'w-[90px]',
      render: (value, item) => (
        <ContentStatus
          published={value !== null}
          showInApp={item.show_in_app}
          removalReason={item.removed_at ? item.removal_reason : null}
          onScreens={onScreenIds.has(item.id)}
        />
      ),
    },
  ];

  return (
    <div className='container mx-auto pb-2 md:pb-8 space-y-6'>
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
          <Tabs value={scope} onValueChange={v => setScope(v as EventScope)}>
            <TabsList>
              {SCOPES.map(option => (
                <TabsTrigger key={option.value} value={option.value}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <ErrorAlert message={error} onClose={() => setError(null)} />

      {loading || isTimezoneLoading ? (
        <TableSkeleton
          columns={columns}
          showRowNumbers={true}
          cardSkeleton={<EventCardSkeleton />}
        />
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
          renderCard={item => <EventCard event={item} timeZone={timeZone} />}
          renderCardFooter={item => (
            <ContentStatus
              published={item.published_at !== null}
              showInApp={item.show_in_app}
              removalReason={item.removed_at ? item.removal_reason : null}
              onScreens={onScreenIds.has(item.id)}
            />
          )}
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
          isDraft={screenAssignItem.published_at === null}
          showInApp={screenAssignItem.show_in_app}
          appShown={screenAssignItem.app_shown_at !== null}
          removalReason={screenAssignItem.removed_at ? screenAssignItem.removal_reason : null}
          onSaved={forceUpdate}
          contentType='events'
          contentLabel={screenAssignItem.title}
          dismissLabel={assignedFromCreate ? 'Skip' : 'Cancel'}
        />
      )}
    </div>
  );
}

/** Phone card: a calendar tile for the date, then title, description, time and place. */
function EventCard({ event, timeZone }: { event: Event; timeZone: string | null }) {
  const at = (options: Intl.DateTimeFormatOptions, value = event.date_time) =>
    formatZoned(value, timeZone, options);
  const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const day: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

  const end = event.end_time;
  const sameDay = end && at(day) === at(day, end);
  const when = end
    ? `${at(time)} – ${sameDay ? at(time, end) : at({ month: 'short', day: 'numeric', ...time }, end)}`
    : at(time);

  return (
    <div className='flex gap-4'>
      <div className='flex w-14 shrink-0 flex-col items-center rounded-lg border bg-muted/40 py-2 text-center'>
        <span className='text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400'>
          {at({ month: 'short' })}
        </span>
        <span className='text-2xl font-semibold leading-tight tabular-nums'>
          {at({ day: 'numeric' })}
        </span>
        <span className='text-[11px] text-muted-foreground'>{at({ weekday: 'short' })}</span>
      </div>

      <div className='min-w-0 flex-1 space-y-1.5'>
        <div className='line-clamp-2 font-medium'>{event.title}</div>
        {event.description && (
          <p className='line-clamp-2 text-sm text-muted-foreground'>{event.description}</p>
        )}
        <div className='space-y-1 pt-0.5 text-sm text-muted-foreground'>
          <div className='flex items-center gap-2'>
            <Clock className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{when}</span>
          </div>
          {event.location && (
            <div className='flex items-center gap-2'>
              <MapPin className='h-3.5 w-3.5 shrink-0' />
              <span className='truncate'>{event.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className='flex gap-4'>
      <Skeleton className='h-[4.5rem] w-14 shrink-0 rounded-lg' />
      <div className='flex-1 space-y-2'>
        <Skeleton className='h-5 w-2/3' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-1/2' />
        <Skeleton className='h-4 w-1/3' />
      </div>
    </div>
  );
}
