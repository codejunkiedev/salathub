import { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Label,
  Checkbox,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
  DialogClose,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { screenSchema, type ScreenData } from '@/lib/zod';
import { createScreen, getMasjidProfile, updateScreen } from '@/lib/supabase';
import type { DisplayScreen, PrayerAlertTrigger } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { Link } from 'react-router';
import { AppRoutes } from '@/constants';

type ScreenModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: DisplayScreen;
};

const ALERT_TRIGGERS: { value: PrayerAlertTrigger; label: string }[] = [
  { value: 'athan', label: 'Athan Time' },
  { value: 'iqamah', label: 'Iqamah Time' },
];

/**
 * Form values for a screen. Existing screens saved before a field was
 * introduced come back without it, so every optional-in-practice column falls
 * back to the same default a brand new screen gets.
 */
const toFormValues = (screen?: DisplayScreen): ScreenData => ({
  name: screen?.name ?? '',
  orientation: screen?.orientation ?? 'landscape',
  show_prayer_times: screen?.show_prayer_times ?? true,
  show_weather: screen?.show_weather ?? true,
  show_follow_qr: screen?.show_follow_qr ?? false,
  language: screen?.language ?? 'en',
  slide_interval_seconds: screen?.slide_interval_seconds ?? 5,
  prayer_alert_triggers: screen?.prayer_alert_triggers ?? [],
});

export function ScreenModal({ isOpen, onClose, onSuccess, initialData }: ScreenModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isListed, setIsListed] = useState(false);
  const isEdit = !!initialData;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScreenData>({
    resolver: zodResolver(screenSchema),
    defaultValues: toFormValues(initialData),
  });

  const showPrayerTimes = watch('show_prayer_times');
  const showWeather = watch('show_weather');
  const showFollowQr = watch('show_follow_qr');
  const orientation = watch('orientation');
  const language = watch('language');
  const alertTriggers = watch('prayer_alert_triggers');

  const toggleAlertTrigger = (trigger: PrayerAlertTrigger, checked: boolean) => {
    // Keep the stored order stable so a saved screen doesn't churn its column
    // just because the boxes were ticked in a different order.
    const next = ALERT_TRIGGERS.map(({ value }) => value).filter(value =>
      value === trigger ? checked : alertTriggers.includes(value)
    );
    setValue('prayer_alert_triggers', next);
  };

  useEffect(() => {
    if (isOpen) {
      reset(toFormValues(initialData));
      setIsCopied(false);
    }
  }, [isOpen, initialData, reset]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getMasjidProfile()
      .then(profile => {
        if (!cancelled) setIsListed(profile?.listed ?? false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleCopyCode = async () => {
    if (!initialData?.code) return;
    try {
      await navigator.clipboard.writeText(initialData.code);
      setIsCopied(true);
      toast.success('Screen code copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const onSubmit = async (data: ScreenData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (isEdit && initialData) {
        await updateScreen(initialData.id, data);
      } else {
        await createScreen(data);
      }

      toast.success(`Screen ${isEdit ? 'updated' : 'created'} successfully`);
      reset();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving screen:', err);
      setError('Failed to save screen. Please try again.');
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} screen, please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-[640px]' onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Screen' : 'Add New Screen'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 pt-2'>
          {error && (
            <div className='bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded'>
              {error}
            </div>
          )}

          {isEdit && initialData?.code && (
            <div className='space-y-1.5'>
              <Label>Screen Code</Label>
              <div className='flex relative'>
                <Input
                  value={initialData.code}
                  readOnly
                  className='bg-muted cursor-not-allowed pr-10'
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={handleCopyCode}
                  className='absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8'
                  title='Copy screen code'
                >
                  <Copy size={16} className={isCopied ? 'text-green-500' : ''} />
                </Button>
              </div>
              <p className='text-xs text-muted-foreground'>
                Use this code to connect a display to this screen.
              </p>
            </div>
          )}

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='space-y-1.5'>
              <Label htmlFor='name'>Name</Label>
              <Input
                id='name'
                placeholder='e.g. Main Hall, Entrance'
                className={errors.name ? 'border-destructive' : ''}
                {...register('name')}
              />
              {errors.name && <p className='text-destructive text-sm'>{errors.name.message}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='orientation'>Orientation</Label>
              <Select
                value={orientation}
                onValueChange={v => setValue('orientation', v as ScreenData['orientation'])}
              >
                <SelectTrigger id='orientation' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='landscape'>Landscape</SelectItem>
                  <SelectItem value='portrait'>Portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='language'>Display Language</Label>
              <Select
                value={language}
                onValueChange={v => setValue('language', v as ScreenData['language'])}
              >
                <SelectTrigger id='language' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='en'>English</SelectItem>
                  <SelectItem value='ur'>اردو (Urdu)</SelectItem>
                  <SelectItem value='ar'>العربية (Arabic)</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>Used for prayer times & weather.</p>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='slide_interval_seconds'>Slide Interval (seconds)</Label>
              <Input
                id='slide_interval_seconds'
                type='number'
                min={5}
                max={60}
                step={1}
                className={errors.slide_interval_seconds ? 'border-destructive' : ''}
                {...register('slide_interval_seconds', { valueAsNumber: true })}
              />
              {errors.slide_interval_seconds ? (
                <p className='text-destructive text-sm'>{errors.slide_interval_seconds.message}</p>
              ) : (
                <p className='text-xs text-muted-foreground'>5–60s. Videos ignore this.</p>
              )}
            </div>
          </div>

          <div className='space-y-2'>
            <Label>Default Slides</Label>
            <div className='flex items-center gap-6'>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='show_prayer_times'
                  checked={showPrayerTimes}
                  onCheckedChange={checked => setValue('show_prayer_times', !!checked)}
                />
                <label htmlFor='show_prayer_times' className='text-sm cursor-pointer'>
                  Show Prayer Times
                </label>
              </div>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='show_weather'
                  checked={showWeather}
                  onCheckedChange={checked => setValue('show_weather', !!checked)}
                />
                <label htmlFor='show_weather' className='text-sm cursor-pointer'>
                  Show Weather
                </label>
              </div>
            </div>
          </div>

          <div className='space-y-2'>
            <Label>Follow QR</Label>
            <div className='flex items-center space-x-2'>
              <Checkbox
                id='show_follow_qr'
                checked={showFollowQr}
                disabled={!isListed && !showFollowQr}
                onCheckedChange={checked => setValue('show_follow_qr', !!checked)}
              />
              <label htmlFor='show_follow_qr' className='text-sm cursor-pointer'>
                Show Follow QR
              </label>
            </div>
            <p className='text-xs text-muted-foreground'>
              {isListed ? (
                'Adds a slide people can scan to follow the masjid in the Alkhairia app.'
              ) : (
                <>
                  Appears only while the masjid is listed in the Alkhairia app. Turn listing on in{' '}
                  <Link
                    to={AppRoutes.SettingsAlkhairiaApp}
                    className='text-foreground underline underline-offset-2'
                  >
                    Alkhairia App settings
                  </Link>
                  .
                </>
              )}
            </p>
          </div>

          {/* No enable switch: the ticked times are the switch, and one that
              only gated two checkboxes sitting under it said the same thing
              twice. */}
          <div className='space-y-2'>
            <Label>Prayer Alert</Label>
            <div className='flex items-center gap-6'>
              {ALERT_TRIGGERS.map(({ value, label }) => (
                <div key={value} className='flex items-center space-x-2'>
                  <Checkbox
                    id={`prayer_alert_trigger_${value}`}
                    checked={alertTriggers.includes(value)}
                    onCheckedChange={checked => toggleAlertTrigger(value, !!checked)}
                  />
                  <label
                    htmlFor={`prayer_alert_trigger_${value}`}
                    className='text-sm cursor-pointer'
                  >
                    {label}
                  </label>
                </div>
              ))}
            </div>
            <p className='text-xs text-muted-foreground'>
              Beeps as each ticked time arrives; leave both clear to stay silent. Some browsers stay
              muted until the screen is touched once.
            </p>
          </div>

          <DialogFooter className='pt-2'>
            <DialogClose asChild>
              <Button type='button' variant='outline'>
                Cancel
              </Button>
            </DialogClose>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
