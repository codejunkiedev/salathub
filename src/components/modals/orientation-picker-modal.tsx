import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  DialogFooter,
} from '@/components/ui';
import type { ScreenOrientation } from '@/types';
import { cn } from '@/utils';

const ORIENTATION_CONFIG: Record<
  ScreenOrientation,
  { label: string; dimensions: string; shape: { w: string; h: string } }
> = {
  landscape: { label: 'Landscape', dimensions: '1920 × 1080', shape: { w: 'w-32', h: 'h-20' } },
  portrait: { label: 'Portrait', dimensions: '1080 × 1920', shape: { w: 'w-20', h: 'h-32' } },
};

interface OrientationPickerModalProps<T extends ScreenOrientation> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemLabel: string;
  orientations: readonly T[];
  defaultValue?: T;
  onSelect: (orientation: T) => void;
}

export function OrientationPickerModal<T extends ScreenOrientation>({
  open,
  onOpenChange,
  title,
  itemLabel,
  orientations,
  defaultValue,
  onSelect,
}: OrientationPickerModalProps<T>) {
  const [value, setValue] = useState<T>(defaultValue ?? orientations[0]);

  const handleCancel = () => onOpenChange(false);
  const handleContinue = () => {
    onOpenChange(false);
    onSelect(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className='space-y-6'>
          <p className='text-sm text-muted-foreground'>
            Choose the screen type this {itemLabel} is for. This cannot be changed later.
          </p>

          <RadioGroup
            value={value}
            onValueChange={v => setValue(v as T)}
            className='grid gap-3 grid-cols-2'
          >
            {orientations.map(o => {
              const cfg = ORIENTATION_CONFIG[o];
              const id = `orientation-${o}`;
              const isSelected = value === o;
              return (
                <Label
                  key={o}
                  htmlFor={id}
                  className={cn(
                    'flex flex-col items-center gap-3 border-2 rounded-md p-6 cursor-pointer transition',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-border hover:bg-accent hover:border-muted-foreground/40'
                  )}
                >
                  <RadioGroupItem id={id} value={o} />
                  <div
                    className={cn(
                      'rounded border border-border',
                      isSelected ? 'bg-primary/15' : 'bg-foreground/10',
                      cfg.shape.w,
                      cfg.shape.h
                    )}
                  />
                  <span className='font-medium'>{cfg.label}</span>
                  <span className='text-xs text-muted-foreground'>{cfg.dimensions}</span>
                </Label>
              );
            })}
          </RadioGroup>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleCancel}>
              Cancel
            </Button>
            <Button type='button' onClick={handleContinue}>
              Continue
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
