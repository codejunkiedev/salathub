import type { ReactNode } from 'react';
import {
  CircleCheck,
  CircleDashed,
  EyeOff,
  Monitor,
  MonitorSmartphone,
  Smartphone,
} from 'lucide-react';
import { SimpleTooltip } from '@/components/ui';

interface ContentStatusProps {
  published: boolean;
  /** For types that can reach the app: whether it shows in the app. */
  showInApp?: boolean;
  /** Whether it is assigned to at least one screen. Used with `showInApp`. */
  onScreens?: boolean;
}

/** Compact status icons for content lists, each labelled by a tooltip. */
export function ContentStatus({ published, showInApp, onScreens = false }: ContentStatusProps) {
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
      {showInApp !== undefined && <ReachIcon app={showInApp} screens={onScreens} />}
    </div>
  );
}

function ReachIcon({ app, screens }: { app: boolean; screens: boolean }) {
  const className = 'h-4 w-4 text-muted-foreground';
  if (app && screens) {
    return (
      <StatusIcon label='Screens and app'>
        <MonitorSmartphone className={className} />
      </StatusIcon>
    );
  }
  if (app) {
    return (
      <StatusIcon label='App only'>
        <Smartphone className={className} />
      </StatusIcon>
    );
  }
  if (screens) {
    return (
      <StatusIcon label='Screens only'>
        <Monitor className={className} />
      </StatusIcon>
    );
  }
  return (
    <StatusIcon label='Not shown anywhere'>
      <EyeOff className={className} />
    </StatusIcon>
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
