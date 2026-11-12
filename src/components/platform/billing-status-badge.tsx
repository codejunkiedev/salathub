import { format } from 'date-fns';
import { Badge } from '@/components/ui';
import type { MasjidBilling } from '@/types';
import { cn } from '@/utils';

type BillingSummary = Pick<
  MasjidBilling,
  'plan' | 'status' | 'trial_ends_at' | 'renews_at' | 'grace_ends_at' | 'granted_until'
>;

const STYLES: Record<MasjidBilling['status'], { label: string; className: string }> = {
  none: { label: 'Free', className: 'bg-muted text-muted-foreground' },
  trial: {
    label: 'Pro trial',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  active: {
    label: 'Pro',
    className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  cancelled: {
    label: 'Pro, not renewing',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  payment_failed: {
    label: 'Payment failed',
    className: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  },
  granted: {
    label: 'Free Pro',
    className: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  },
};

export function BillingStatusBadge({ billing }: { billing: BillingSummary | null }) {
  if (!billing) return null;
  const style = STYLES[billing.status];
  return (
    <Badge variant='outline' className={cn('border-transparent', style.className)}>
      {style.label}
    </Badge>
  );
}

/** The date that matters for the masjid's current plan, with what it means. */
export function billingDate(
  billing: BillingSummary | null
): { label: string; date: string } | null {
  const value = (label: string, iso: string | null) =>
    iso ? { label, date: format(new Date(iso), 'd MMM yyyy') } : null;
  switch (billing?.status) {
    case 'trial':
      return value('Trial ends', billing.trial_ends_at);
    case 'active':
      return value('Renews', billing.renews_at);
    case 'cancelled':
      return value('Pro ends', billing.renews_at);
    case 'payment_failed':
      return value('Grace ends', billing.grace_ends_at);
    case 'granted':
      return value('Free until', billing.granted_until);
    default:
      return null;
  }
}
