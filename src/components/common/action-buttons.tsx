import { Button } from '@/components/ui';
import { ArrowRight, Edit, Trash2, Monitor, Send, Undo2 } from 'lucide-react';

type ActionButtonsProps = {
  onEdit?: () => void;
  onDelete: () => void;
  onScreens?: () => void;
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
  onGoto,
  onTogglePublish,
  published,
  centered = true,
}: ActionButtonsProps) {
  return (
    <div className={`flex ${centered ? 'justify-center' : ''} space-x-1`}>
      {onGoto && (
        <Button variant='ghost' size='sm' onClick={onGoto} title='Open' className='hover:bg-muted'>
          <ArrowRight className='h-4 w-4' />
        </Button>
      )}
      {onTogglePublish && (
        <Button
          variant='ghost'
          size='sm'
          onClick={onTogglePublish}
          title={published ? 'Unpublish' : 'Publish'}
          className='hover:bg-muted'
        >
          {published ? <Undo2 className='h-4 w-4' /> : <Send className='h-4 w-4' />}
        </Button>
      )}
      {onScreens && (
        <Button
          variant='ghost'
          size='sm'
          onClick={onScreens}
          title='Assign to screens'
          className='hover:bg-muted'
        >
          <Monitor className='h-4 w-4' />
        </Button>
      )}
      {onEdit && (
        <Button variant='ghost' size='sm' onClick={onEdit} title='Edit' className='hover:bg-muted'>
          <Edit className='h-4 w-4' />
        </Button>
      )}
      <Button
        variant='ghost'
        size='sm'
        onClick={onDelete}
        title='Delete'
        className='hover:bg-destructive/10 hover:text-destructive'
      >
        <Trash2 className='h-4 w-4 text-destructive' />
      </Button>
    </div>
  );
}
