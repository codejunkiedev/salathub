import type { ReactNode } from 'react';
import { Button, SimpleTooltip } from '@/components/ui';
import { ArrowRight, Edit, Trash2, Monitor, Send, Undo2 } from 'lucide-react';

type ActionButtonsProps = {
  onEdit?: () => void;
  onDelete: () => void;
  onScreens?: () => void;
  /** Tooltip for the screens button. Defaults to "Assign to screens". */
  screensLabel?: string;
  onGoto?: () => void;
  /** Shows a publish or unpublish button, depending on `published`. */
  onTogglePublish?: () => void;
  published?: boolean;
  centered?: boolean;
};

/**
 * Renders action buttons for opening, editing, deleting, and optionally publishing or
 * assigning to screens
 */
export function ActionButtons({
  onEdit,
  onDelete,
  onScreens,
  screensLabel = 'Assign to screens',
  onGoto,
  onTogglePublish,
  published,
  centered = true,
}: ActionButtonsProps) {
  return (
    <div className={`flex ${centered ? 'justify-center' : ''} space-x-1`}>
      {onGoto && (
        <ActionButton label='Open' onClick={onGoto}>
          <ArrowRight className='h-4 w-4' />
        </ActionButton>
      )}
      {onTogglePublish && (
        <ActionButton label={published ? 'Unpublish' : 'Publish'} onClick={onTogglePublish}>
          {published ? <Undo2 className='h-4 w-4' /> : <Send className='h-4 w-4' />}
        </ActionButton>
      )}
      {onScreens && (
        <ActionButton label={screensLabel} onClick={onScreens}>
          <Monitor className='h-4 w-4' />
        </ActionButton>
      )}
      {onEdit && (
        <ActionButton label='Edit' onClick={onEdit}>
          <Edit className='h-4 w-4' />
        </ActionButton>
      )}
      <ActionButton
        label='Delete'
        onClick={onDelete}
        className='hover:bg-destructive/10 hover:text-destructive'
      >
        <Trash2 className='h-4 w-4 text-destructive' />
      </ActionButton>
    </div>
  );
}

type ActionButtonProps = {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
};

function ActionButton({
  label,
  onClick,
  className = 'hover:bg-muted',
  children,
}: ActionButtonProps) {
  return (
    <SimpleTooltip label={label}>
      <Button variant='ghost' size='sm' onClick={onClick} aria-label={label} className={className}>
        {children}
      </Button>
    </SimpleTooltip>
  );
}
