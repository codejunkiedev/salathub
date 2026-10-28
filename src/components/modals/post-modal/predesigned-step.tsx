import { Button, DialogFooter, Input, Label, PredesignedImageSelector } from '@/components/ui';
import { SaveContentButtons } from '@/components/common';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { PostData } from '@/lib/zod';
import { ModalError } from './modal-error';

type PredesignedStepProps = {
  selectedImage: string | null;
  onImageSelect: (url: string) => void;
  register: UseFormRegister<PostData>;
  errors: FieldErrors<PostData>;
  onBack: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  isSubmitting: boolean;
  error?: string | null;
};

export function PredesignedStep({
  selectedImage,
  onImageSelect,
  register,
  errors,
  onBack,
  onSubmit,
  onSaveDraft,
  isSubmitting,
  error,
}: PredesignedStepProps) {
  return (
    <div className='space-y-4 pt-4'>
      <ModalError message={error} />

      <div className='space-y-2'>
        <Label>Select a Predesigned Image</Label>
        <PredesignedImageSelector selectedImage={selectedImage} onImageSelect={onImageSelect} />
      </div>

      {selectedImage && (
        <div className='space-y-2'>
          <Label htmlFor='title'>Post Title</Label>
          <Input
            id='title'
            placeholder='Enter post title'
            className={errors.title ? 'border-destructive' : ''}
            {...register('title')}
          />
          {errors.title && <p className='text-destructive text-sm'>{errors.title.message}</p>}
        </div>
      )}

      <DialogFooter>
        <Button type='button' variant='outline' onClick={onBack}>
          Back
        </Button>
        {selectedImage && (
          <SaveContentButtons
            isEdit={false}
            isSubmitting={isSubmitting}
            onSaveDraft={onSaveDraft}
            onSubmit={onSubmit}
          />
        )}
      </DialogFooter>
    </div>
  );
}
