import { Link, useLocation } from 'react-router';
import { format } from 'date-fns';
import { Ban, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui';
import { AppRoutes } from '@/constants';
import { useMasjidVerification } from '@/hooks';
import { useAuthStore } from '@/store';
import { cn } from '@/utils';

/**
 * Stays across the console until the masjid submits its documents, and again
 * after a rejection or a suspension. Admins only, since only they can act on it.
 */
export default function VerificationBanner() {
  const isAdmin = useAuthStore(s => s.role) === 'admin';
  const { pathname } = useLocation();
  const { verification } = useMasjidVerification();

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

  const Icon = tone === 'danger' ? Ban : ShieldAlert;

  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center',
        tone === 'danger'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      )}
    >
      <Icon className='h-4 w-4 shrink-0' />
      <p className='flex-1'>{message}</p>
      <Button asChild size='sm' variant='outline' className='shrink-0'>
        <Link to={AppRoutes.SettingsVerification}>{action}</Link>
      </Button>
    </div>
  );
}
