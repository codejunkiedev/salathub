import type { ReactNode } from 'react';
import { CircleCheck, CircleDashed, Monitor, MonitorSmartphone } from 'lucide-react';
import { SimpleTooltip } from '@/components/ui';

interface ContentStatusProps {
  published: boolean;
  /** For types that can reach the app: shows whether it goes to the app or screens only. */
  showInApp?: boolean;
}

/** Compact status icons for content lists, each labelled by a tooltip. */
export function ContentStatus({ published, showInApp }: ContentStatusProps) {
  return (
    <div className='flex items-center gap-2'>
      {published ? (
        <StatusIcon label='Published'>
          <CircleCheck className='h-4 w-4 text-emerald-500' />
        </StatusIcon>
      ) : (
        <StatusIcon label='Draft'>
          <CircleDashed className='h-4 w-4 text-muted-foreground' />
        </StatusIcon>
      )}
      {showInApp === true && (
        <StatusIcon label='Screens and app'>
          <MonitorSmartphone className='h-4 w-4 text-muted-foreground' />
        </StatusIcon>
      )}
      {showInApp === false && (
        <StatusIcon label='Screens only'>
          <Monitor className='h-4 w-4 text-muted-foreground' />
        </StatusIcon>
      )}
    </div>
  );
}

function StatusIcon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <SimpleTooltip label={label}>
      <span className='inline-flex'>
        {children}
        <span className='sr-only'>{label}</span>
      </span>
    </SimpleTooltip>
  );
}
