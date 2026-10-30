import { AlertCircle, X } from 'lucide-react';

type ErrorAlertProps = {
  message: string | null;
  onClose?: () => void;
};

export function ErrorAlert({ message, onClose }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div
      role='alert'
      className='flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive'
    >
      <AlertCircle className='h-4 w-4 shrink-0' />
      <p className='flex-1'>{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className='-mr-1 p-1 text-destructive/70 hover:text-destructive'
          aria-label='Close'
        >
          <X className='h-4 w-4' />
        </button>
      )}
    </div>
  );
}
