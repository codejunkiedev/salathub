import { useState } from 'react';
import { format } from 'date-fns';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@/components/ui';

const REASON_MAX = 500;
const MAX_TRIAL_DAYS = 365;

type GrantDialogProps = {
  kind: 'pro' | 'trial_extension' | null;
  isSaving: boolean;
  /** Pro: the end of the chosen day, local time. Trial: the number of days. */
  onConfirm: (value: Date | number, reason: string) => Promise<void>;
  onClose: () => void;
};

/** Gives a masjid free Pro until a date, or extends its trial, with the reason logged. */
export function BillingGrantDialog({ kind, isSaving, onConfirm, onClose }: GrantDialogProps) {
  const [until, setUntil] = useState('');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');

  const trimmed = reason.trim();
  const today = format(new Date(), 'yyyy-MM-dd');
  const untilDate = until ? new Date(`${until}T23:59:59`) : null;
  const dayCount = Number(days);
  const valid =
    !!trimmed &&
    (kind === 'pro'
      ? !!untilDate && until >= today
      : Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= MAX_TRIAL_DAYS);

  const close = () => {
    setUntil('');
    setDays('');
    setReason('');
    onClose();
  };

  return (
    <Dialog open={kind !== null} onOpenChange={open => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'pro' ? 'Give free Pro' : 'Extend trial'}</DialogTitle>
          <DialogDescription>
            {kind === 'pro'
              ? 'The masjid gets Pro at no cost until the end of the chosen day, then moves to Free unless it has upgraded. Its admins are emailed 30 and 7 days before it ends.'
              : 'Adds days to the trial. A masjid whose trial already ended starts a new one from today.'}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          {kind === 'pro' ? (
            <div className='space-y-2'>
              <Label htmlFor='grant-until'>Free Pro until</Label>
              <Input
                id='grant-until'
                type='date'
                min={today}
                value={until}
                onChange={e => setUntil(e.target.value)}
              />
            </div>
          ) : (
            <div className='space-y-2'>
              <Label htmlFor='trial-days'>Days to add</Label>
              <Input
                id='trial-days'
                type='number'
                inputMode='numeric'
                min={1}
                max={MAX_TRIAL_DAYS}
                value={days}
                onChange={e => setDays(e.target.value)}
              />
            </div>
          )}
          <div className='space-y-2'>
            <Label htmlFor='grant-reason'>Reason</Label>
            <Textarea
              id='grant-reason'
              value={reason}
              maxLength={REASON_MAX}
              rows={3}
              placeholder={
                kind === 'pro' ? "e.g. Sponsored, or the masjid's card won't go through" : ''
              }
              onChange={e => setReason(e.target.value)}
            />
            <p className='text-xs text-muted-foreground'>
              Logged with your email. Only our team sees it.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={close} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            loading={isSaving}
            disabled={isSaving || !valid}
            onClick={async () => {
              await onConfirm(kind === 'pro' ? untilDate! : dayCount, trimmed);
              setUntil('');
              setDays('');
              setReason('');
            }}
          >
            {kind === 'pro' ? 'Give free Pro' : 'Extend trial'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
