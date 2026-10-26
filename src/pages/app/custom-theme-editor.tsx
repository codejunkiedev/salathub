import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Label, Switch, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { CustomThemeControls } from '@/components/settings/custom-theme-controls';
import { Theme4 } from '@/components/display/prayer-timings/themes';
import type { ThemeProps } from '@/components/display/prayer-timings/themes/types';
import { getMasjidProfile, getScreenById, updateScreenCustomTheme } from '@/lib/supabase';
import { AppRoutes, DEFAULT_CUSTOM_THEME } from '@/constants';
import { formatContactDetails, localizedProfileField, resolveCustomTheme } from '@/helpers';
import { nowInTimeZone } from '@/utils';
import type {
  CustomThemeConfig,
  DisplayLanguage,
  DisplayScreen,
  MasjidProfile,
  ProcessedPrayerTiming,
} from '@/types';

// Representative timings so the preview shows a populated layout. Isha iqamah is
// late so there is always an upcoming iqamah to render in the countdown card. All
// three Jummas carry a time so switching one on shows a row here even though the
// screen's real prayer settings are not loaded into this preview.
const SAMPLE_TIMINGS: ProcessedPrayerTiming[] = [
  { name: 'fajr', starts: '04:45', athan: '05:00', iqamah: '05:15', arabicName: '' },
  { name: 'dhuhr', starts: '12:15', athan: '12:30', iqamah: '12:45', arabicName: '' },
  { name: 'jumma1', starts: '13:00', athan: '13:15', iqamah: '13:30', arabicName: '' },
  { name: 'jumma2', starts: '13:45', athan: '14:00', iqamah: '14:15', arabicName: '' },
  { name: 'jumma3', starts: '14:30', athan: '14:45', iqamah: '15:00', arabicName: '' },
  { name: 'asr', starts: '15:45', athan: '16:00', iqamah: '16:15', arabicName: '' },
  { name: 'maghrib', starts: '19:30', athan: '19:30', iqamah: '19:40', arabicName: '' },
  { name: 'isha', starts: '21:00', athan: '21:15', iqamah: '23:59', arabicName: '' },
];

// Localized sample dates so the preview reads correctly in each language, in an
// ordinary-day and a Friday variant — Friday is the only day the Next Iqamah card
// counts down to Jumma, so the preview needs to be able to be one.
type SampleDay = 'weekday' | 'friday';

const SAMPLE_DATES: Record<
  DisplayLanguage,
  Record<SampleDay, { gregorian: string; hijri: string }>
> = {
  en: {
    weekday: { gregorian: 'Monday, 15 June 2026', hijri: '1 Muharram 1448' },
    friday: { gregorian: 'Friday, 19 June 2026', hijri: '5 Muharram 1448' },
  },
  ur: {
    weekday: { gregorian: 'پیر، 15 جون 2026', hijri: '1 محرم 1448' },
    friday: { gregorian: 'جمعہ، 19 جون 2026', hijri: '5 محرم 1448' },
  },
  ar: {
    weekday: { gregorian: 'الاثنين، 15 يونيو 2026', hijri: '1 محرم 1448' },
    friday: { gregorian: 'الجمعة، 19 يونيو 2026', hijri: '5 محرم 1448' },
  },
};

const SAMPLE_MASJID_NAME = 'Masjid Name';

const PREVIEW_LANGUAGES: { value: DisplayLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'اردو' },
  { value: 'ar', label: 'العربية' },
];

export default function CustomThemeEditor() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const screenId = params.id;

  const [screen, setScreen] = useState<DisplayScreen | null>(null);
  const [profile, setProfile] = useState<MasjidProfile | null>(null);
  const [loadedScreenId, setLoadedScreenId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [config, setConfig] = useState<CustomThemeConfig>(() =>
    structuredClone(DEFAULT_CUSTOM_THEME)
  );
  const [dirty, setDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Preview-only language; defaults to the screen's, lets the admin check other
  // scripts without changing the screen's actual Display Language.
  const [previewLanguage, setPreviewLanguage] = useState<DisplayLanguage>('en');
  const [previewFriday, setPreviewFriday] = useState(false);
  const fridayId = useId();

  // Load the screen and seed the config from its saved custom theme.
  useEffect(() => {
    if (!screenId) return;
    let cancelled = false;
    Promise.all([getScreenById(screenId), getMasjidProfile().catch(() => null)])
      .then(([result, masjidProfile]) => {
        if (cancelled) return;
        if (!result) {
          setNotFound(true);
          return;
        }
        setScreen(result);
        setProfile(masjidProfile);
        setConfig(resolveCustomTheme(result.custom_theme));
        setPreviewLanguage(result.language);
        setDirty(false);
      })
      .catch(error => {
        console.error('Error loading screen:', error);
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoadedScreenId(screenId);
      });
    return () => {
      cancelled = true;
    };
  }, [screenId]);

  // Shared by the preview and the banner controls, which echo it back so the
  // admin can see what the contact option will scroll before saving.
  const contactDetails = useMemo(() => formatContactDetails(profile), [profile]);

  const previewProps: ThemeProps | null = useMemo(() => {
    if (!screen) return null;
    const localizedMasjidName = localizedProfileField(profile, 'name', previewLanguage);
    // The preview clock should read what the screen in the masjid would read.
    const timeZone = profile?.timezone ?? null;
    const sampleDate = SAMPLE_DATES[previewLanguage][previewFriday ? 'friday' : 'weekday'];
    return {
      gregorianDate: sampleDate.gregorian,
      hijriDate: sampleDate.hijri,
      sunrise: '04:30',
      sunset: '19:45',
      ishraq: '04:45',
      chasht: '08:22',
      currentTime: nowInTimeZone(timeZone),
      timeZone,
      processedPrayerTimings: SAMPLE_TIMINGS,
      prayerTimeSettings: null,
      isFriday: previewFriday,
      orientation: screen.orientation,
      masjidName: localizedMasjidName || SAMPLE_MASJID_NAME,
      // No sample stand-in, unlike the name: an admin who has not filled the
      // contact fields in should see the empty banner the screen would show,
      // not a plausible-looking phone number.
      contactDetails,
      customTheme: config,
      previewLanguage,
    };
  }, [config, screen, profile, contactDetails, previewLanguage, previewFriday]);

  const goBack = () =>
    navigate(screenId ? AppRoutes.ScreenDetail.replace(':id', screenId) : AppRoutes.Screens);

  const handleChange = (next: CustomThemeConfig) => {
    setConfig(next);
    setDirty(true);
  };

  const handleReset = () => {
    setConfig(structuredClone(DEFAULT_CUSTOM_THEME));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!screen) return;
    setIsSubmitting(true);
    try {
      await updateScreenCustomTheme(screen.id, config);
      toast.success('Theme saved');
      goBack();
    } catch (error) {
      console.error('Error saving custom theme:', error);
      toast.error('Failed to save customization');
      setIsSubmitting(false);
    }
  };

  if (screenId && loadedScreenId !== screenId) {
    return (
      <div className='flex h-screen items-center justify-center bg-background'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  if (notFound || !screen || !previewProps) {
    return (
      <div className='container mx-auto py-12 text-center space-y-4'>
        <h1 className='text-2xl font-semibold'>Screen not found</h1>
        <p className='text-muted-foreground'>This screen may have been deleted.</p>
        <Button onClick={() => navigate(AppRoutes.Screens)}>Back to screens</Button>
      </div>
    );
  }

  const isPortrait = screen.orientation === 'portrait';

  return (
    <div className='flex flex-col h-screen bg-background'>
      <header className='flex items-center justify-between gap-4 px-6 py-4 border-b'>
        <div className='flex items-center gap-3'>
          <Button
            variant='ghost'
            size='icon'
            onClick={goBack}
            aria-label='Back'
            disabled={isSubmitting}
          >
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div>
            <h1 className='text-xl font-semibold'>Customize Theme</h1>
            <p className='text-xs text-muted-foreground capitalize'>
              {screen.name} · {screen.orientation}
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='ghost' onClick={handleReset} disabled={isSubmitting}>
            <RotateCcw className='h-4 w-4 mr-2' />
            Reset
          </Button>
          <Button variant='outline' onClick={goBack} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting || !dirty}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </header>

      <div className='flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-6'>
        {/* Live preview */}
        <div className='flex flex-col items-center justify-center gap-3 min-h-[300px]'>
          <div className='flex items-center gap-4'>
            <Tabs
              value={previewLanguage}
              onValueChange={v => setPreviewLanguage(v as DisplayLanguage)}
            >
              <TabsList className='grid w-full max-w-md grid-cols-3'>
                {PREVIEW_LANGUAGES.map(l => (
                  <TabsTrigger key={l.value} value={l.value}>
                    {l.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className='flex items-center gap-2'>
              <Label htmlFor={fridayId} className='text-xs text-muted-foreground cursor-pointer'>
                Friday
              </Label>
              <Switch id={fridayId} checked={previewFriday} onCheckedChange={setPreviewFriday} />
            </div>
          </div>
          <div
            className={`w-full overflow-hidden rounded-lg border bg-muted ${
              isPortrait ? 'max-w-[420px] aspect-[9/16]' : 'max-w-full aspect-video'
            }`}
          >
            <Theme4 {...previewProps} />
          </div>
        </div>

        {/* Controls */}
        <div className='overflow-y-auto pr-2'>
          <CustomThemeControls
            config={config}
            onChange={handleChange}
            orientation={isPortrait ? 'portrait' : 'landscape'}
            previewLanguage={previewLanguage}
            contactDetails={contactDetails}
          />
        </div>
      </div>
    </div>
  );
}
