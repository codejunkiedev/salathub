import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@/components/ui';

const REASON_MAX = 500;

interface ReasonDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  reasonRequired: boolean;
  isSaving: boolean;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

/** Asks for the reason behind a rejection or suspension. */
export function ReasonDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  reasonRequired,
  isSaving,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  const close = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className='space-y-2'>
          <Label htmlFor='reason'>Reason{reasonRequired ? '' : ' (optional)'}</Label>
          <Textarea
            id='reason'
            value={reason}
            maxLength={REASON_MAX}
            rows={4}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={close} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant='destructive'
            loading={isSaving}
            disabled={isSaving || (reasonRequired && !trimmed)}
            onClick={async () => {
              await onConfirm(trimmed);
              setReason('');
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
