import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Sparkles, X } from 'lucide-react';
import { buttonVariants } from '@/components/ui';
import { AppRoutes } from '@/constants';
import { useMasjidBilling } from '@/hooks';
import { useAuthStore } from '@/store';
import { trialDaysLeft } from '@/utils';

// Dismissed for this visit only; a new visit or a new day's count shows it again.
const DISMISSED_KEY = 'trial-banner-dismissed';

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/** Counts down the Pro trial across the console. Admins only, since only they can upgrade. */
export default function TrialBanner() {
  const isAdmin = useAuthStore(s => s.role) === 'admin';
  const { pathname } = useLocation();
  const { billing } = useMasjidBilling();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!isAdmin || billing?.status !== 'trial' || pathname === AppRoutes.SettingsBilling) {
    return null;
  }

  const days = trialDaysLeft(billing.trial_ends_at);
  const message =
    days <= 1
      ? 'Last day of your free Pro trial. Upgrade to keep Pro.'
      : `${days} days left in your free Pro trial.`;

  if (dismissed === message) return null;

  const dismiss = () => {
    setDismissed(message);
    try {
      sessionStorage.setItem(DISMISSED_KEY, message);
    } catch {
      // Storage blocked: it stays hidden until the page reloads.
    }
  };

  return (
    <div className='relative mb-4 flex flex-col gap-3 rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:pr-11 dark:bg-amber-950/40 dark:text-amber-200'>
      <div className='flex flex-1 items-start gap-3 pr-7 sm:items-center sm:pr-0'>
        <Sparkles className='mt-0.5 h-4 w-4 shrink-0 sm:mt-0' />
        <p>{message}</p>
      </div>
      <Link
        to={AppRoutes.SettingsBilling}
        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}
      >
        View plan
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
