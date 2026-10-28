import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  DateTimePicker,
  Textarea,
} from '@/components/ui';
import { eventSchema, type EventData } from '@/lib/zod';
import { upsertEvent } from '@/lib/supabase';
import { SaveContentButtons } from '@/components/common';
import type { Event } from '@/types';
import {
  describeTimeZone,
  eventEndsAt,
  formatZonedDateTime,
  fromZonedWallClock,
  getDeviceTimeZone,
  parseInstant,
  toZonedWallClock,
} from '@/utils';
import { toast } from 'sonner';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdEvent?: Event) => void;
  initialData?: Event;
  /** The masjid's IANA zone. Null falls back to this device's. */
  timeZone: string | null;
}

const EMPTY_EVENT: EventData = {
  title: '',
  description: '',
  date_time: '',
  end_time: null,
  location: '',
  chief_guest: '',
  host: '',
  qari: '',
  naat_khawn: '',
  karm_farma: '',
};

/** A stored instant as a Date the pickers can edit in the masjid's wall clock */
const toWallClock = (
  value: string | null | undefined,
  timeZone: string | null
): Date | undefined => {
  const instant = parseInstant(value);
  return instant ? toZonedWallClock(instant, timeZone) : undefined;
};

/**
 * Modal component for creating and editing events with details like title, date, location, and participants
 */
export function EventModal({ isOpen, onClose, onSuccess, initialData, timeZone }: EventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initialData;

  // The pickers work in local Date fields, so both are held as wall clocks in
  // the masjid's zone and converted to instants on the way into the form.
  const [dateTime, setDateTime] = useState<Date | undefined>(() =>
    toWallClock(initialData?.date_time, timeZone)
  );
  const [endTime, setEndTime] = useState<Date | undefined>(() =>
    toWallClock(initialData?.end_time, timeZone)
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EventData>({
    resolver: zodResolver(eventSchema),
    defaultValues: initialData || EMPTY_EVENT,
  });

  useEffect(() => {
    if (isOpen) reset(initialData || EMPTY_EVENT);
  }, [initialData, isOpen, reset]);

  // Kept out of the form reset above: the zone is fetched and can land after the
  // modal opens, and resetting the form there would wipe what is being typed.
  const [prevSync, setPrevSync] = useState({ isOpen, initialData, timeZone });
  if (
    prevSync.isOpen !== isOpen ||
    prevSync.initialData !== initialData ||
    prevSync.timeZone !== timeZone
  ) {
    const openedOrSwapped = prevSync.isOpen !== isOpen || prevSync.initialData !== initialData;
    setPrevSync({ isOpen, initialData, timeZone });
    if (isOpen && initialData) {
      setDateTime(toWallClock(initialData.date_time, timeZone));
      setEndTime(toWallClock(initialData.end_time, timeZone));
    } else if (isOpen && openedOrSwapped) {
      setDateTime(undefined);
      setEndTime(undefined);
    }
  }

  useEffect(() => {
    if (dateTime) {
      setValue('date_time', fromZonedWallClock(dateTime, timeZone).toISOString());
    }
  }, [dateTime, timeZone, setValue]);

  useEffect(() => {
    setValue('end_time', endTime ? fromZonedWallClock(endTime, timeZone).toISOString() : null, {
      shouldValidate: !!endTime,
    });
  }, [endTime, timeZone, setValue]);

  const startInstant = dateTime ? fromZonedWallClock(dateTime, timeZone) : null;

  const impliedEnd =
    startInstant && !endTime
      ? formatZonedDateTime(
          eventEndsAt({ date_time: startInstant.toISOString(), end_time: null }),
          timeZone
        )
      : null;

  const timeZoneNote = timeZone
    ? `Times are in ${describeTimeZone(timeZone)}, the masjid's timezone, wherever you are entering them from.`
    : `This masjid has no timezone set, so times use this device's (${describeTimeZone(getDeviceTimeZone())}). Set one under Settings, Masjid Profile.`;

  const onSubmit = async (data: EventData, publish = true) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const saved = await upsertEvent(
        {
          ...data,
          ...(initialData?.id && { id: initialData.id }),
        },
        publish
      );
      toast.success(`Event ${isEdit ? 'updated' : publish ? 'published' : 'saved as draft'}`);

      reset();
      setDateTime(undefined);
      setEndTime(undefined);
      onSuccess(isEdit ? undefined : saved);
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      setError('Failed to save event. Please try again.');
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} event, please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-[850px] max-h-[90vh] overflow-y-auto scrollbar-custom'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(data => onSubmit(data))} className='space-y-6 pt-4'>
          {error && (
            <div className='bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded'>
              {error}
            </div>
          )}

          <div className='space-y-4'>
            <h3 className='text-sm font-medium text-gray-500'>Basic Information</h3>

            <div className='space-y-2'>
              <Label htmlFor='title'>Title</Label>
              <Input
                id='title'
                placeholder='Enter event title'
                className={errors.title ? 'border-destructive' : ''}
                {...register('title')}
              />
              {errors.title && <p className='text-destructive text-sm'>{errors.title.message}</p>}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                placeholder='Enter event description'
                className={`resize-none h-24 ${errors.description ? 'border-destructive' : ''}`}
                {...register('description')}
              />
              {errors.description && (
                <p className='text-destructive text-sm'>{errors.description.message}</p>
              )}
            </div>

            <div className='grid md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='date_time'>Starts</Label>
                <DateTimePicker date={dateTime} setDate={setDateTime} disabled={isSubmitting} />
                {errors.date_time && (
                  <p className='text-destructive text-sm'>{errors.date_time.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='end_time'>
                    Ends
                    <span className='ml-2 text-xs text-muted-foreground font-normal'>Optional</span>
                  </Label>
                  {endTime && (
                    <button
                      type='button'
                      onClick={() => setEndTime(undefined)}
                      className='text-xs text-muted-foreground hover:text-foreground'
                    >
                      Clear
                    </button>
                  )}
                </div>
                <DateTimePicker date={endTime} setDate={setEndTime} disabled={isSubmitting} />
                {errors.end_time ? (
                  <p className='text-destructive text-sm'>{errors.end_time.message}</p>
                ) : (
                  impliedEnd && (
                    <p className='text-xs text-muted-foreground'>
                      Left blank, this event stops showing at {impliedEnd}.
                    </p>
                  )
                )}
              </div>
            </div>

            <p className='text-xs text-muted-foreground'>{timeZoneNote}</p>

            <div className='space-y-2'>
              <Label htmlFor='location'>Location</Label>
              <Input
                id='location'
                placeholder='Enter event location'
                className={errors.location ? 'border-destructive' : ''}
                {...register('location')}
              />
              {errors.location && (
                <p className='text-destructive text-sm'>{errors.location.message}</p>
              )}
            </div>
          </div>

          <div className='border-t border-gray-200'></div>

          <div className='space-y-4'>
            <h3 className='text-sm font-medium text-gray-500'>Participants</h3>

            <div className='grid md:grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='chief_guest'>Chief Guest</Label>
                <Input
                  id='chief_guest'
                  placeholder='Enter chief guest name'
                  className={errors.chief_guest ? 'border-destructive' : ''}
                  {...register('chief_guest')}
                />
                {errors.chief_guest && (
                  <p className='text-destructive text-sm'>{errors.chief_guest.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='host'>Host</Label>
                <Input
                  id='host'
                  placeholder='Enter host name (optional)'
                  className={errors.host ? 'border-destructive' : ''}
                  {...register('host')}
                />
                {errors.host && <p className='text-destructive text-sm'>{errors.host.message}</p>}
              </div>
            </div>

            <div className='grid md:grid-cols-3 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='qari'>Qari</Label>
                <Input
                  id='qari'
                  placeholder='Enter qari name'
                  className={errors.qari ? 'border-destructive' : ''}
                  {...register('qari')}
                />
                {errors.qari && <p className='text-destructive text-sm'>{errors.qari.message}</p>}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='naat_khawn'>Naat Khawn</Label>
                <Input
                  id='naat_khawn'
                  placeholder='Enter naat khawn name'
                  className={errors.naat_khawn ? 'border-destructive' : ''}
                  {...register('naat_khawn')}
                />
                {errors.naat_khawn && (
                  <p className='text-destructive text-sm'>{errors.naat_khawn.message}</p>
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='karm_farma'>Karm Farma</Label>
                <Input
                  id='karm_farma'
                  placeholder='Enter karm farma name'
                  className={errors.karm_farma ? 'border-destructive' : ''}
                  {...register('karm_farma')}
                />
                {errors.karm_farma && (
                  <p className='text-destructive text-sm'>{errors.karm_farma.message}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className='mt-6'>
            <DialogClose asChild>
              <Button type='button' variant='outline'>
                Cancel
              </Button>
            </DialogClose>
            <SaveContentButtons
              isEdit={isEdit}
              isSubmitting={isSubmitting}
              onSaveDraft={handleSubmit(data => onSubmit(data, false))}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
