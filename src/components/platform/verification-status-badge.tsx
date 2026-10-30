import { Badge } from '@/components/ui';
import type { MasjidVerification } from '@/types';
import { cn } from '@/utils';

const STYLES = {
  not_submitted: { label: 'Not submitted', className: 'bg-muted text-muted-foreground' },
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  verified: {
    label: 'Verified',
    className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  },
  suspended: { label: 'Suspended', className: 'bg-destructive text-white' },
};

export function VerificationStatusBadge({
  verification,
}: {
  verification: MasjidVerification | null;
}) {
  if (!verification) return null;
  const style = STYLES[verification.suspended_at ? 'suspended' : verification.status];
  return (
    <Badge variant='outline' className={cn('border-transparent', style.className)}>
      {style.label}
    </Badge>
  );
}
