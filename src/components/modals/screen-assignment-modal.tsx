import { useState, useEffect, useMemo, type ReactNode } from 'react';
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
import {
  getScreens,
  getScreensForContent,
  bulkUpdateScreenAssignments,
  setShowInApp,
} from '@/lib/supabase';
import type { AppContentType, DisplayScreen, PostOrientation, ScreenContentType } from '@/types';
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
  /** The item's current `show_in_app`, for the types that can reach the app. */
  showInApp?: boolean;
  /** Why the SalatHub team removed it from the app, if they did. */
  removalReason?: string | null;
  /** Called after a successful save, so the caller can refetch. */
  onSaved?: () => void;
};

const APP_CONTENT_TYPES: ScreenContentType[] = [
  'announcements',
  'events',
  'posts',
] satisfies AppContentType[];

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
  showInApp,
  removalReason,
  onSaved,
}: ScreenAssignmentModalProps) {
  const isRemoved = removalReason != null;
  const hasAppOption = APP_CONTENT_TYPES.includes(contentType);
  const currentShowInApp = showInApp ?? true;
  const [screens, setScreens] = useState<DisplayScreen[]>([]);
  const [appSelected, setAppSelected] = useState(currentShowInApp);
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
        setAppSelected(currentShowInApp);
      } catch (err) {
        console.error('Error fetching screen data:', err);
        toast.error('Failed to load screens');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOpen, contentId, contentType, currentShowInApp]);

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
      await Promise.all([
        bulkUpdateScreenAssignments(contentId, contentType, Array.from(selectedScreenIds)),
        hasAppOption && appSelected !== currentShowInApp
          ? setShowInApp(contentType as AppContentType, contentId, appSelected)
          : null,
      ]);
      toast.success(hasAppOption ? 'Saved where this shows' : 'Screen assignments updated');
      onSaved?.();
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
          <DialogTitle>{hasAppOption ? 'Where to show' : 'Assign to Screens'}</DialogTitle>
          {contentLabel && (
            <p className='text-sm text-muted-foreground mt-1 line-clamp-1'>{contentLabel}</p>
          )}
        </DialogHeader>

        <div className='py-2'>
          {isLoading ? (
            <div className='flex items-center justify-center py-10'>
              <div className='animate-spin h-6 w-6 border-2 border-muted border-t-foreground rounded-full' />
            </div>
          ) : (
            <div className='space-y-2'>
              {isDraft && (
                <Note>
                  {hasAppOption
                    ? "This is a draft. It won't show anywhere until you publish it."
                    : "This is a draft. It won't show on these screens until you publish it."}
                </Note>
              )}

              {hasAppOption && (
                <>
                  <ChoiceRow
                    id='app-followers'
                    checked={appSelected && !isRemoved}
                    onToggle={() => setAppSelected(prev => !prev)}
                    disabled={isSaving || isRemoved}
                    icon={<Smartphone className='w-4 h-4 text-muted-foreground' />}
                    title='App followers'
                    subtitle={
                      isRemoved
                        ? `Removed from the app by SalatHub: ${removalReason}`
                        : "Shows in your masjid's feed in the app"
                    }
                  />
                  <p className='text-xs font-medium text-muted-foreground pt-3 pb-1'>Screens</p>
                </>
              )}

              {compatibleScreens.length === 0 ? (
                <div
                  className={`flex flex-col items-center text-center gap-3 ${hasAppOption ? 'py-4' : 'py-10'}`}
                >
                  {!hasAppOption && (
                    <div className='w-10 h-10 rounded-full bg-muted flex items-center justify-center'>
                      <Monitor className='w-5 h-5 text-muted-foreground' />
                    </div>
                  )}
                  <p className='text-sm text-muted-foreground max-w-[280px]'>
                    {screens.length === 0
                      ? 'No screens created yet. Create a screen first from the Screens page.'
                      : `No compatible screens found. This post requires a ${orientationLabel} screen.`}
                  </p>
                </div>
              ) : (
                <>
                  {contentOrientation && incompatibleCount > 0 && (
                    <Note>
                      Only <strong>{orientationLabel}</strong> screens are shown.{' '}
                      {incompatibleCount} incompatible screen
                      {incompatibleCount !== 1 ? 's' : ''} {incompatibleCount !== 1 ? 'are' : 'is'}{' '}
                      hidden.
                    </Note>
                  )}

                  {compatibleScreens.map(screen => (
                    <ChoiceRow
                      key={screen.id}
                      id={`screen-${screen.id}`}
                      checked={selectedScreenIds.has(screen.id)}
                      onToggle={() => handleToggle(screen.id)}
                      disabled={isSaving}
                      icon={<OrientationIcon orientation={screen.orientation} />}
                      title={screen.name}
                      subtitle={`${screen.orientation === 'portrait' ? 'Portrait' : 'Landscape'} · ${screen.code}`}
                    />
                  ))}
                </>
              )}
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
            disabled={isSaving || isLoading || (!hasAppOption && compatibleScreens.length === 0)}
            loading={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className='flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-3 py-2.5 mb-3'>
      <Info className='w-3.5 h-3.5 mt-0.5 shrink-0' />
      <span>{children}</span>
    </div>
  );
}

type ChoiceRowProps = {
  id: string;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
  icon: ReactNode;
  title: string;
  subtitle: string;
};

function ChoiceRow({ id, checked, onToggle, disabled, icon, title, subtitle }: ChoiceRowProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-colors ${
        checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'
      } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} disabled={disabled} />
      {icon}
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-medium leading-none'>{title}</p>
        <p className='text-xs text-muted-foreground mt-1'>{subtitle}</p>
      </div>
    </label>
  );
}
