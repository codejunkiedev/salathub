import { Link } from 'react-router';
import { Sparkles } from 'lucide-react';
import { AppRoutes } from '@/constants';
import { useAuthStore } from '@/store';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/utils';

/**
 * Marks a feature the masjid's plan doesn't include; links admins to Billing.
 * Pass link={false} inside something that is already a link.
 */
export function ProBadge({ className, link = true }: { className?: string; link?: boolean }) {
  const isAdmin = useAuthStore(s => s.role) === 'admin';
  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200',
        className
      )}
    >
      <Sparkles className='h-3 w-3' />
      Pro
    </span>
  );
  if (!isAdmin || !link) return badge;
  return (
    <Link to={AppRoutes.SettingsBilling} onClick={e => e.stopPropagation()} title='See plans'>
      {badge}
    </Link>
  );
}

/** Top-of-page notice for a feature the plan doesn't include. */
export function ProFeatureNotice({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore(s => s.role) === 'admin';
  return (
    <div className='flex flex-col gap-3 rounded-lg border border-violet-300/60 bg-violet-50 px-4 py-3 text-sm text-violet-900 sm:flex-row sm:items-center dark:bg-violet-950/40 dark:text-violet-100'>
      <Sparkles className='h-4 w-4 shrink-0' />
      <div className='flex-1 space-y-1'>{children}</div>
      {isAdmin && (
        <Link
          to={AppRoutes.SettingsBilling}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}
        >
          View plan
        </Link>
      )}
    </div>
  );
}
