import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { format } from 'date-fns';
import { Ban, ShieldAlert, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui';
import { AppRoutes } from '@/constants';
import { useMasjidVerification } from '@/hooks';
import { useAuthStore } from '@/store';
import { cn } from '@/utils';

// Holds the message that was dismissed, so a different message shows again.
const DISMISSED_KEY = 'verification-banner-dismissed';

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/**
 * Stays across the console until the masjid submits its documents, and again
 * after a rejection or a suspension. Admins only, since only they can act on it.
 */
export default function VerificationBanner() {
  const isAdmin = useAuthStore(s => s.role) === 'admin';
  const { pathname } = useLocation();
  const { verification } = useMasjidVerification();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!isAdmin || !verification || pathname === AppRoutes.SettingsVerification) return null;

  const deadline = verification.grace_until
    ? format(new Date(verification.grace_until), 'd MMM yyyy')
    : null;

  let tone: 'warning' | 'danger' = 'warning';
  let message: string;
  let action = 'Verify now';

  if (verification.suspended_at) {
    tone = 'danger';
    message = 'The masjid is suspended from the Alkhairia app. Its screens keep working.';
    action = 'View details';
  } else if (verification.status === 'not_submitted') {
    message = deadline
      ? `Verify your masjid by ${deadline} to keep it in the Alkhairia app.`
      : 'Verify your masjid to list it in the Alkhairia app. Your screens work as normal.';
  } else if (verification.status === 'rejected') {
    tone = 'danger';
    message = `Verification wasn't approved: ${verification.rejection_reason}`;
    action = 'Resubmit';
  } else {
    return null;
  }

  if (dismissed === message) return null;

  const dismiss = () => {
    setDismissed(message);
    try {
      localStorage.setItem(DISMISSED_KEY, message);
    } catch {
      // Storage blocked: it stays hidden until the page reloads.
    }
  };

  const Icon = tone === 'danger' ? Ban : ShieldAlert;

  return (
    <div
      className={cn(
        'relative mb-4 flex flex-col gap-3 rounded-lg border py-3 pl-4 pr-11 text-sm sm:flex-row sm:items-center',
        tone === 'danger'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      )}
    >
      <div className='flex flex-1 items-start gap-3 sm:items-center'>
        <Icon className='mt-0.5 h-4 w-4 shrink-0 sm:mt-0' />
        <p>{message}</p>
      </div>
      <Link
        to={AppRoutes.SettingsVerification}
        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}
      >
        {action}
      </Link>
      <button
        type='button'
        onClick={dismiss}
        aria-label='Dismiss'
        className='absolute right-2 top-2 rounded-md p-1.5 opacity-70 transition-opacity hover:opacity-100 sm:top-1/2 sm:-translate-y-1/2'
      >
        <X className='h-4 w-4' />
      </button>
    </div>
  );
}
