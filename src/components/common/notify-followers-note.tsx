import { BellRing } from 'lucide-react';
import { useContentNotificationStatus } from '@/hooks';
import { cn, contentNotificationLine } from '@/utils';
import type { AppContentType } from '@/types';

/** Says whether an item about to show in the app will notify followers. */
export function NotifyFollowersNote({
  type,
  className,
}: {
  type: AppContentType;
  className?: string;
}) {
  const line = contentNotificationLine(useContentNotificationStatus(), type);
  if (!line) return null;

  return (
    <p className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <BellRing className='h-3.5 w-3.5 shrink-0' />
      {line}
    </p>
  );
}
