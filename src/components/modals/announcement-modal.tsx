import { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Textarea,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  DialogClose,
} from '@/components/ui';
import { announcementSchema, type AnnouncementData } from '@/lib/zod';
import { upsertAnnouncement } from '@/lib/supabase';
import type { Announcement } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Label } from '@/components/ui';
import { toast } from 'sonner';

const toFormValues = (announcement?: Announcement): AnnouncementData => ({
  title: announcement?.title ?? '',
  description: announcement?.description ?? '',
});

type AnnouncementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdAnnouncement?: Announcement) => void;
  initialData?: Announcement;
};

/**
 * Modal component for creating and editing announcements with form validation
 */
export function AnnouncementModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AnnouncementModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AnnouncementData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: toFormValues(initialData),
  });

  useEffect(() => {
    if (isOpen) {
      reset(toFormValues(initialData));
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (data: AnnouncementData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const saved = await upsertAnnouncement({
        ...data,
        ...(initialData?.id && { id: initialData.id }),
      });
      toast.success(`Announcement ${isEdit ? 'updated' : 'created'} successfully`);

      reset();
      onSuccess(isEdit ? undefined : saved);
      onClose();
    } catch (error) {
      console.error('Error saving announcement:', error);
      setError('Failed to save announcement. Please try again.');
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} announcement, please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-[550px]'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Announcement' : 'Add New Announcement'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 pt-4'>
          {error && (
            <div className='bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded mb-4'>
              {error}
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='title'>Title</Label>
            <Input
              id='title'
              placeholder='Enter announcement title'
              className={errors.title ? 'border-destructive' : ''}
              {...register('title')}
            />
            {errors.title && <p className='text-destructive text-sm'>{errors.title.message}</p>}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='description'>Description</Label>
            <Textarea
              id='description'
              placeholder='Enter announcement details here...'
              className={`resize-none h-40 ${errors.description ? 'border-destructive' : ''}`}
              {...register('description')}
            />
            {errors.description && (
              <p className='text-destructive text-sm'>{errors.description.message}</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' variant='outline'>
                Cancel
              </Button>
            </DialogClose>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
