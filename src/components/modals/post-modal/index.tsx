import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { postSchema, type PostData } from '@/lib/zod';
import { upsertPost } from '@/lib/supabase';
import { useImageValidation } from '@/hooks';
import { downscaleImageToCover } from '@/utils';
import type { Post, PostOrientation } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ImageSourcePicker } from './image-source-picker';
import { PredesignedStep } from './predesigned-step';
import { UploadForm } from './upload-form';

type PostModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdPost?: Post) => void;
  initialData?: Post;
  presetOrientation?: PostOrientation;
};

type ImageSource = 'predesigned' | 'upload' | null;

export function PostModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  presetOrientation,
}: PostModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrientation, setSelectedOrientation] = useState<PostOrientation | null>(
    presetOrientation ?? null
  );
  const [imageSource, setImageSource] = useState<ImageSource>(
    presetOrientation === 'portrait' ? 'upload' : null
  );
  const [selectedPredesignedImage, setSelectedPredesignedImage] = useState<string | null>(null);

  const {
    imageFile,
    imageError,
    validationState,
    isValidating,
    handleImageChange,
    resetValidation,
  } = useImageValidation();

  const isEdit = useMemo(() => !!initialData, [initialData]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<PostData>({
    resolver: zodResolver(postSchema),
    defaultValues: initialData
      ? { title: initialData.title, orientation: initialData.orientation }
      : { title: '', orientation: presetOrientation ?? 'landscape' },
  });

  useEffect(() => {
    if (initialData) {
      setValue('title', initialData.title);
      setValue('orientation', initialData.orientation);
    }
  }, [initialData, setValue]);

  useEffect(() => {
    if (initialData?.image_url) resetValidation();
  }, [initialData, resetValidation]);

  const resetSteps = useCallback(() => {
    resetValidation();
    setSelectedOrientation(presetOrientation ?? null);
    setImageSource(presetOrientation === 'portrait' ? 'upload' : null);
    setSelectedPredesignedImage(null);
  }, [resetValidation, presetOrientation]);

  const [prevSync, setPrevSync] = useState({ isOpen, initialData, presetOrientation });
  if (
    prevSync.isOpen !== isOpen ||
    prevSync.initialData !== initialData ||
    prevSync.presetOrientation !== presetOrientation
  ) {
    setPrevSync({ isOpen, initialData, presetOrientation });
    if (!isOpen || !initialData) resetSteps();
  }

  const handleClose = useCallback(() => {
    reset();
    resetSteps();
    setError(null);
    onClose();
  }, [reset, resetSteps, onClose]);

  const handleBackToOrientation = useCallback(() => {
    if (presetOrientation) {
      handleClose();
      return;
    }
    setSelectedOrientation(null);
    setImageSource(null);
    resetValidation();
    setSelectedPredesignedImage(null);
  }, [resetValidation, presetOrientation, handleClose]);

  const handleBackToSource = useCallback(() => {
    setImageSource(null);
    resetValidation();
    setSelectedPredesignedImage(null);
  }, [resetValidation]);

  const activeOrientation: PostOrientation =
    (isEdit ? initialData?.orientation : selectedOrientation) ?? 'landscape';

  const isUploadStep = isEdit || imageSource === 'upload';

  const onSubmit = async (data: PostData) => {
    if (!imageFile && !selectedPredesignedImage && !initialData?.image_url) {
      setError('Image is required');
      return;
    }
    if (imageFile && validationState && !validationState.isValid) {
      setError('Please upload a valid image that matches the selected orientation');
      return;
    }
    if (imageError) {
      setError(imageError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let imageToUse = imageFile;
      if (selectedPredesignedImage && !imageFile) {
        const response = await fetch(selectedPredesignedImage);
        const blob = await response.blob();
        const fileName = selectedPredesignedImage.split('/').pop() || 'predesigned-image.jpg';
        imageToUse = new File([blob], fileName, { type: blob.type });
      }

      // Downscale + crop uploads to the exact display ratio before storing, so
      // the post fills the 16:9/9:16 frame without letterbox bars.
      if (imageToUse) {
        imageToUse = await downscaleImageToCover(imageToUse, activeOrientation);
      }

      const saved = await upsertPost(
        { ...data, ...(initialData?.id && { id: initialData.id }) },
        imageToUse
      );
      toast.success(`Post ${isEdit ? 'updated' : 'created'} successfully`);

      reset();
      resetSteps();
      setError(null);
      onSuccess(isEdit ? undefined : saved);
      onClose();
    } catch {
      setError('Failed to save post. Please try again.');
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} post, please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className={isUploadStep ? 'sm:max-w-[760px]' : 'sm:max-w-[550px]'}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Post' : 'Add New Post'}</DialogTitle>
        </DialogHeader>

        {!isEdit && selectedOrientation === 'landscape' && !imageSource && (
          <ImageSourcePicker
            onSelect={setImageSource}
            onBack={handleBackToOrientation}
            error={error}
          />
        )}

        {!isEdit && imageSource === 'predesigned' && (
          <PredesignedStep
            selectedImage={selectedPredesignedImage}
            onImageSelect={setSelectedPredesignedImage}
            register={register}
            errors={errors}
            onBack={handleBackToSource}
            onSubmit={handleSubmit(onSubmit)}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}

        {(isEdit || imageSource === 'upload') && (
          <UploadForm
            orientation={activeOrientation}
            isEdit={isEdit}
            register={register}
            errors={errors}
            onImageChange={file => handleImageChange(file, activeOrientation)}
            validationState={validationState}
            isValidating={isValidating}
            imageError={imageError}
            existingImageUrl={initialData?.image_url}
            isSubmitting={isSubmitting}
            onBack={
              isEdit
                ? handleClose
                : activeOrientation === 'portrait'
                  ? handleBackToOrientation
                  : handleBackToSource
            }
            onSubmit={handleSubmit(onSubmit)}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
