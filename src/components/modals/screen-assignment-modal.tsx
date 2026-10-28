import { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  DialogClose,
} from '@/components/ui';
import { Monitor, Smartphone, Info } from 'lucide-react';
import { getScreens, getScreensForContent, bulkUpdateScreenAssignments } from '@/lib/supabase';
import type { DisplayScreen, PostOrientation, ScreenContentType } from '@/types';
import { toast } from 'sonner';

type ScreenAssignmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentType: ScreenContentType;
  contentLabel?: string;
  /** When provided (posts only), restricts which screens can be assigned */
  contentOrientation?: PostOrientation;
  /** Label for the dismiss button. Defaults to "Cancel". Use "Skip" in creation flows. */
  dismissLabel?: string;
  /** Shows a note that drafts stay off screens until published. */
  isDraft?: boolean;
};

function OrientationIcon({ orientation }: { orientation: DisplayScreen['orientation'] }) {
  if (orientation === 'portrait') return <Smartphone className='w-4 h-4 text-muted-foreground' />;
  return <Monitor className='w-4 h-4 text-muted-foreground' />;
}

export function ScreenAssignmentModal({
  isOpen,
  onClose,
  contentId,
  contentType,
  contentLabel,
  contentOrientation,
  dismissLabel = 'Cancel',
  isDraft = false,
}: ScreenAssignmentModalProps) {
  const [screens, setScreens] = useState<DisplayScreen[]>([]);
  const [selectedScreenIds, setSelectedScreenIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !contentId) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [allScreens, assignments] = await Promise.all([
          getScreens(),
          getScreensForContent(contentId, contentType),
        ]);
        setScreens(allScreens);
        setSelectedScreenIds(new Set(assignments.map(a => a.screen_id)));
      } catch (err) {
        console.error('Error fetching screen data:', err);
        toast.error('Failed to load screens');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, contentId, contentType]);

  const compatibleScreens = useMemo(() => {
    if (!contentOrientation) return screens;
    return screens.filter(s => s.orientation === contentOrientation);
  }, [screens, contentOrientation]);

  const incompatibleCount = screens.length - compatibleScreens.length;

  const handleToggle = (screenId: string) => {
    setSelectedScreenIds(prev => {
      const next = new Set(prev);
      if (next.has(screenId)) {
        next.delete(screenId);
      } else {
        next.add(screenId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await bulkUpdateScreenAssignments(contentId, contentType, Array.from(selectedScreenIds));
      toast.success('Screen assignments updated');
      onClose();
    } catch (err) {
      console.error('Error saving screen assignments:', err);
      toast.error('Failed to update screen assignments');
    } finally {
      setIsSaving(false);
    }
  };

  const orientationLabel = contentOrientation === 'portrait' ? 'portrait' : 'landscape';

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-[450px]'>
        <DialogHeader>
          <DialogTitle>Assign to Screens</DialogTitle>
          {contentLabel && (
            <p className='text-sm text-muted-foreground mt-1 line-clamp-1'>{contentLabel}</p>
          )}
        </DialogHeader>

        <div className='py-2'>
          {isLoading ? (
            <div className='flex items-center justify-center py-10'>
              <div className='animate-spin h-6 w-6 border-2 border-muted border-t-foreground rounded-full' />
            </div>
          ) : compatibleScreens.length === 0 ? (
            <div className='flex flex-col items-center text-center py-10 gap-3'>
              <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center'>
                <Monitor className='w-5 h-5 text-muted-foreground' />
              </div>
              <p className='text-sm text-muted-foreground max-w-[280px]'>
                {screens.length === 0
                  ? 'No screens created yet. Create a screen first from the Screens page.'
                  : `No compatible screens found. This post requires a ${orientationLabel} screen.`}
              </p>
            </div>
          ) : (
            <div className='space-y-2'>
              {isDraft && (
                <div className='flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-3 py-2.5 mb-3'>
                  <Info className='w-3.5 h-3.5 mt-0.5 shrink-0' />
                  <span>This is a draft. It won't show on these screens until you publish it.</span>
                </div>
              )}

              {contentOrientation && incompatibleCount > 0 && (
                <div className='flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-3 py-2.5 mb-3'>
                  <Info className='w-3.5 h-3.5 mt-0.5 shrink-0' />
                  <span>
                    Only <strong>{orientationLabel}</strong> screens are shown. {incompatibleCount}{' '}
                    incompatible screen{incompatibleCount !== 1 ? 's' : ''}{' '}
                    {incompatibleCount !== 1 ? 'are' : 'is'} hidden.
                  </span>
                </div>
              )}

              {compatibleScreens.map(screen => {
                const isSelected = selectedScreenIds.has(screen.id);
                return (
                  <label
                    key={screen.id}
                    htmlFor={`screen-${screen.id}`}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    } ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <Checkbox
                      id={`screen-${screen.id}`}
                      checked={isSelected}
                      onCheckedChange={() => handleToggle(screen.id)}
                      disabled={isSaving}
                    />
                    <OrientationIcon orientation={screen.orientation} />
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium leading-none'>{screen.name}</p>
                      <p className='text-xs text-muted-foreground mt-1 capitalize'>
                        {screen.orientation} · {screen.code}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type='button' variant='outline'>
              {dismissLabel}
            </Button>
          </DialogClose>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading || compatibleScreens.length === 0}
            loading={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
