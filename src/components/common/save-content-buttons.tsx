import { useState } from 'react';
import { Button } from '@/components/ui';

type SaveContentButtonsProps = {
  isEdit: boolean;
  isSubmitting: boolean;
  /** Disables the buttons for reasons other than an in-flight save. */
  disabled?: boolean;
  /** Saves without publishing. Only shown when creating. */
  onSaveDraft: () => void;
  /**
   * Publishes (or updates, when editing). Leave it out inside a form: the
   * button then submits the form, so pressing Enter publishes.
   */
  onSubmit?: () => void;
};

/**
 * Footer buttons for content forms. Creating offers "Save as draft" and
 * "Publish"; editing offers "Update", which keeps the item's publish state.
 */
export function SaveContentButtons({
  isEdit,
  isSubmitting,
  disabled = false,
  onSaveDraft,
  onSubmit,
}: SaveContentButtonsProps) {
  const [pending, setPending] = useState<'draft' | 'publish'>('publish');
  const isDisabled = isSubmitting || disabled;

  const submitButton = (
    <Button
      type={onSubmit ? 'button' : 'submit'}
      disabled={isDisabled}
      onClick={() => {
        setPending('publish');
        onSubmit?.();
      }}
    >
      {isEdit
        ? isSubmitting
          ? 'Saving...'
          : 'Update'
        : isSubmitting && pending === 'publish'
          ? 'Publishing...'
          : 'Publish'}
    </Button>
  );

  if (isEdit) return submitButton;

  return (
    <>
      <Button
        type='button'
        variant='secondary'
        disabled={isDisabled}
        onClick={() => {
          setPending('draft');
          onSaveDraft();
        }}
      >
        {isSubmitting && pending === 'draft' ? 'Saving...' : 'Save as draft'}
      </Button>
      {submitButton}
    </>
  );
}
