import {
  Button,
  DialogFooter,
  Input,
  Label,
  ImageUpload,
  ValidationFeedback,
} from '@/components/ui';
import { SaveContentButtons } from '@/components/common';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { PostData } from '@/lib/zod';
import type { PostOrientation } from '@/types';
import type { ValidationState } from '@/types/validation';
import { OrientationBadge } from './orientation-badge';
import { ModalError } from './modal-error';
import { ImageRequirements } from './image-requirements';

type UploadFormProps = {
  orientation: PostOrientation;
  isEdit: boolean;
  register: UseFormRegister<PostData>;
  errors: FieldErrors<PostData>;
  onImageChange: (file: File | null) => Promise<void>;
  validationState: ValidationState | null;
  isValidating: boolean;
  imageError: string | null;
  existingImageUrl?: string;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onSaveDraft: () => void;
  error?: string | null;
};

export function UploadForm({
  orientation,
  isEdit,
  register,
  errors,
  onImageChange,
  validationState,
  isValidating,
  imageError,
  existingImageUrl,
  isSubmitting,
  onBack,
  onSubmit,
  onSaveDraft,
  error,
}: UploadFormProps) {
  return (
    <form onSubmit={onSubmit} className='space-y-4 pt-4'>
      <ModalError message={error} />

      <OrientationBadge orientation={orientation} showEditNote={isEdit} />

      <div className='space-y-2'>
        <Label htmlFor='title'>Title</Label>
        <Input
          id='title'
          placeholder='Enter post title'
          className={errors.title ? 'border-destructive' : ''}
          {...register('title')}
        />
        {errors.title && <p className='text-destructive text-sm'>{errors.title.message}</p>}
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-[1fr_15rem]'>
        <div className='flex flex-col gap-2'>
          <ImageUpload
            label={`Image (${orientation === 'portrait' ? 'Portrait' : 'Landscape'} Full-Screen)`}
            onChange={onImageChange}
            value={existingImageUrl}
            disabled={isSubmitting}
            orientation={orientation}
            className='flex-1'
          />

          {(validationState || isValidating) && (
            <ValidationFeedback
              isValid={validationState?.isValid ?? false}
              dimensions={validationState?.dimensions}
              recommendation={validationState?.recommendation}
              validationError={imageError ?? undefined}
              isLoading={isValidating}
            />
          )}
        </div>

        <ImageRequirements orientation={orientation} />
      </div>

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onBack}>
          {isEdit ? 'Cancel' : 'Back'}
        </Button>
        <SaveContentButtons isEdit={isEdit} isSubmitting={isSubmitting} onSaveDraft={onSaveDraft} />
      </DialogFooter>
    </form>
  );
}
