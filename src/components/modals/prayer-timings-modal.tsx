import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Minus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Label,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  RadioGroup,
  RadioGroupItem,
  Slider,
  TimePicker,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { prayerAdjustmentsFormSchema, type PrayerAdjustmentsFormData } from '@/lib/zod';
import { savePrayerAdjustments, updateSolarAdjustments } from '@/lib/supabase';
import { parseTimeString, formatTimeString, ISHRAQ_MINUTES_AFTER_SUNRISE } from '@/utils';
import type {
  AdjustmentCategory,
  PrayerAdjustments,
  Settings,
  SingleAdjustment,
  SolarAdjustments,
  SolarTimeName,
} from '@/types';

interface PrayerTimingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  initialValues: PrayerAdjustmentsFormData | null;
  settings: Settings | null;
  onSettingsChange: (settings: Settings) => void;
}

type PrayerName = keyof PrayerAdjustments;
type AdjustmentType = SingleAdjustment['type'];

const PRAYER_LIST: { name: PrayerName; label: string }[] = [
  { name: 'fajr', label: 'Fajr' },
  { name: 'dhuhr', label: 'Dhuhr' },
  { name: 'jumma1', label: 'Jumma 1' },
  { name: 'jumma2', label: 'Jumma 2' },
  { name: 'jumma3', label: 'Jumma 3' },
  { name: 'asr', label: 'Asr' },
  { name: 'maghrib', label: 'Maghrib' },
  { name: 'isha', label: 'Isha' },
];

const CATEGORIES: { key: AdjustmentCategory; label: string }[] = [
  { key: 'starts', label: 'Starts' },
  { key: 'athan', label: 'Athan' },
  { key: 'iqamah', label: 'Iqamah' },
];

const DEFAULT_SINGLE: SingleAdjustment = { type: 'default' };

/**
 * The single-time entries, in the order the sun reaches them. Ishraq and Chasht
 * carry a note because — unlike sunrise and sunset — they are not returned by
 * the prayer time API: they are derived here from conventions a masjid may well
 * keep differently, so the modal says which convention it used.
 */
const SOLAR_LIST: { name: SolarTimeName; label: string; note?: string }[] = [
  { name: 'sunrise', label: 'Sunrise' },
  {
    name: 'ishraq',
    label: 'Ishraq',
    note: `Calculated as ${ISHRAQ_MINUTES_AFTER_SUNRISE} minutes after sunrise, once the sun has risen a spear's length above the horizon.`,
  },
  {
    name: 'chasht',
    label: 'Chasht',
    note: 'Calculated as the midpoint between sunrise and Zawal — a quarter of the day gone, the preferred time for Salat al-Duha.',
  },
  { name: 'sunset', label: 'Sunset' },
];

const DEFAULT_ADJUSTMENT: PrayerAdjustmentsFormData['prayer_adjustments'] = {
  fajr: { starts: DEFAULT_SINGLE, athan: DEFAULT_SINGLE, iqamah: DEFAULT_SINGLE },
  dhuhr: { starts: DEFAULT_SINGLE, athan: DEFAULT_SINGLE, iqamah: DEFAULT_SINGLE },
  asr: { starts: DEFAULT_SINGLE, athan: DEFAULT_SINGLE, iqamah: DEFAULT_SINGLE },
  maghrib: { starts: DEFAULT_SINGLE, athan: DEFAULT_SINGLE, iqamah: DEFAULT_SINGLE },
  isha: { starts: DEFAULT_SINGLE, athan: DEFAULT_SINGLE, iqamah: DEFAULT_SINGLE },
  jumma1: { starts: DEFAULT_SINGLE, athan: DEFAULT_SINGLE, iqamah: DEFAULT_SINGLE },
  jumma2: { starts: DEFAULT_SINGLE, athan: DEFAULT_SINGLE, iqamah: DEFAULT_SINGLE },
  jumma3: { starts: DEFAULT_SINGLE, athan: DEFAULT_SINGLE, iqamah: DEFAULT_SINGLE },
};

export function PrayerTimingsModal({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  settings,
  onSettingsChange,
}: PrayerTimingsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [solar, setSolar] = useState<SolarAdjustments>(() => solarFromSettings(settings));

  const { handleSubmit, setValue, control } = useForm<PrayerAdjustmentsFormData>({
    resolver: zodResolver(prayerAdjustmentsFormSchema),
    defaultValues: {
      prayer_adjustments: initialValues?.prayer_adjustments ?? DEFAULT_ADJUSTMENT,
    },
  });

  useEffect(() => {
    if (initialValues?.prayer_adjustments) {
      setValue('prayer_adjustments', initialValues.prayer_adjustments);
    }
  }, [initialValues, setValue]);

  const [prevSync, setPrevSync] = useState({ isOpen, settings });
  if (prevSync.isOpen !== isOpen || prevSync.settings !== settings) {
    setPrevSync({ isOpen, settings });
    if (isOpen) setSolar(solarFromSettings(settings));
  }

  const onFormSubmit = async (data: PrayerAdjustmentsFormData) => {
    try {
      setIsSubmitting(true);
      await savePrayerAdjustments(data);
      const updatedSettings = await updateSolarAdjustments(solar);
      onSettingsChange(updatedSettings);
      onSubmit();
      onClose();
      toast.success('Prayer time settings saved successfully');
    } catch (error) {
      console.error('Error saving prayer time settings:', error);
      toast.error('Failed to save prayer time settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const prayerAdjustments = useWatch({ control, name: 'prayer_adjustments' });

  const handleTypeChange = (
    prayer: PrayerName,
    category: AdjustmentCategory,
    type: AdjustmentType
  ): void => {
    setValue(`prayer_adjustments.${prayer}.${category}.type`, type);
    if (type === 'offset') {
      setValue(`prayer_adjustments.${prayer}.${category}.manual_time`, undefined);
    } else if (type === 'manual') {
      setValue(`prayer_adjustments.${prayer}.${category}.offset`, undefined);
    } else if (type === 'default') {
      setValue(`prayer_adjustments.${prayer}.${category}.offset`, undefined);
      setValue(`prayer_adjustments.${prayer}.${category}.manual_time`, undefined);
    }
  };

  const getAdjustmentSummary = (adj: SingleAdjustment | undefined): string => {
    if (!adj || adj.type === 'default') return 'Default';
    if (adj.type === 'offset' && adj.offset !== undefined) {
      const sign = adj.offset > 0 ? '+' : adj.offset < 0 ? '-' : '';
      const abs = Math.abs(adj.offset);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return `${sign}${h > 0 ? `${h}h ` : ''}${m}m`;
    }
    if (adj.type === 'manual' && adj.manual_time) {
      return adj.manual_time;
    }
    return 'Default';
  };

  const renderAdjustmentControls = (prayer: PrayerName, category: AdjustmentCategory) =>
    renderSingleAdjustmentControls({
      idPrefix: `${prayer}-${category}`,
      value: prayerAdjustments?.[prayer]?.[category],
      onChange: next => {
        handleTypeChange(prayer, category, next.type);
        if (next.type === 'offset') {
          setValue(`prayer_adjustments.${prayer}.${category}.offset`, next.offset ?? 0);
        } else if (next.type === 'manual') {
          setValue(`prayer_adjustments.${prayer}.${category}.manual_time`, next.manual_time ?? '');
        }
      },
      onOffsetChange: v =>
        setValue(`prayer_adjustments.${prayer}.${category}.offset`, v, { shouldDirty: true }),
      onManualTimeChange: v =>
        setValue(`prayer_adjustments.${prayer}.${category}.manual_time`, v, { shouldDirty: true }),
    });

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-[500px] max-w-[95vw] w-full max-h-[90vh] overflow-y-auto scrollbar-custom'>
        <DialogHeader>
          <DialogTitle>Prayer Time Adjustments</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className='space-y-4 py-2'>
          <Tabs defaultValue='starts' className='w-full'>
            <TabsList className='grid w-full grid-cols-3'>
              {CATEGORIES.map(cat => (
                <TabsTrigger key={cat.key} value={cat.key}>
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIES.map(cat => (
              <TabsContent key={cat.key} value={cat.key} className='pt-2'>
                <Accordion type='single' collapsible className='w-full'>
                  {PRAYER_LIST.map(prayer => {
                    const adj = prayerAdjustments?.[prayer.name]?.[cat.key];
                    const summary = getAdjustmentSummary(adj);
                    const isDefault = !adj || adj.type === 'default';

                    return (
                      <AccordionItem value={prayer.name} key={prayer.name}>
                        <AccordionTrigger className='py-2.5 hover:no-underline'>
                          <div className='flex items-center justify-between w-full pr-2'>
                            <span className='text-sm font-medium'>{prayer.label}</span>
                            <span
                              className={`text-xs ${isDefault ? 'text-muted-foreground' : 'text-primary font-medium'}`}
                            >
                              {summary}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {['jumma1', 'jumma2', 'jumma3'].includes(prayer.name) && (
                            <p className='text-xs text-muted-foreground mb-2'>
                              This adjustment applies only on Fridays.
                            </p>
                          )}
                          {renderAdjustmentControls(prayer.name, cat.key)}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}

                  {cat.key === 'starts' &&
                    SOLAR_LIST.map(item => (
                      <SolarAccordionItem
                        key={item.name}
                        name={item.name}
                        label={item.label}
                        note={item.note}
                        adjustment={solar[item.name]}
                        onChange={next => setSolar(prev => ({ ...prev, [item.name]: next }))}
                        summary={getAdjustmentSummary(solar[item.name])}
                      />
                    ))}
                </Accordion>
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter className='flex flex-col sm:flex-row gap-2 sm:gap-0'>
            <Button type='button' variant='outline' onClick={onClose} className='w-full sm:w-auto'>
              Cancel
            </Button>
            <Button
              type='submit'
              loading={isSubmitting}
              disabled={isSubmitting}
              className='w-full sm:w-auto'
            >
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function solarFromSettings(settings: Settings | null): SolarAdjustments {
  return {
    sunrise: settings?.sunrise_adjustment ?? DEFAULT_SINGLE,
    ishraq: settings?.ishraq_adjustment ?? DEFAULT_SINGLE,
    chasht: settings?.chasht_adjustment ?? DEFAULT_SINGLE,
    sunset: settings?.sunset_adjustment ?? DEFAULT_SINGLE,
  };
}

interface SolarAccordionItemProps {
  name: SolarTimeName;
  label: string;
  note?: string;
  adjustment: SingleAdjustment;
  onChange: (next: SingleAdjustment) => void;
  summary: string;
}

function SolarAccordionItem({
  name,
  label,
  note,
  adjustment,
  onChange,
  summary,
}: SolarAccordionItemProps) {
  const isDefault = adjustment.type === 'default';
  return (
    <AccordionItem value={name}>
      <AccordionTrigger className='py-2.5 hover:no-underline'>
        <div className='flex items-center justify-between w-full pr-2'>
          <span className='text-sm font-medium'>{label}</span>
          <span
            className={`text-xs ${isDefault ? 'text-muted-foreground' : 'text-primary font-medium'}`}
          >
            {summary}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {note && <p className='text-xs text-muted-foreground mb-2'>{note}</p>}
        {renderSingleAdjustmentControls({
          idPrefix: name,
          value: adjustment,
          onChange,
        })}
      </AccordionContent>
    </AccordionItem>
  );
}

interface RenderControlsArgs {
  idPrefix: string;
  value: SingleAdjustment | undefined;
  onChange: (next: SingleAdjustment) => void;
  /** When provided, used instead of onChange for slider drag (RHF setValue without re-creating object). */
  onOffsetChange?: (offset: number) => void;
  onManualTimeChange?: (time: string) => void;
}

function renderSingleAdjustmentControls({
  idPrefix,
  value,
  onChange,
  onOffsetChange,
  onManualTimeChange,
}: RenderControlsArgs) {
  const type = value?.type ?? 'default';
  const offset = value?.offset ?? 0;
  const manualTime = value?.manual_time ?? '';

  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;

  const handleTypeChange = (next: AdjustmentType) => {
    if (next === 'default') onChange({ type: 'default' });
    else if (next === 'offset') onChange({ type: 'offset', offset: value?.offset ?? 0 });
    else onChange({ type: 'manual', manual_time: value?.manual_time ?? '' });
  };

  return (
    <div className='space-y-3 pt-2'>
      <RadioGroup
        value={type}
        onValueChange={v => handleTypeChange(v as AdjustmentType)}
        className='flex flex-row gap-4'
      >
        <div className='flex items-center space-x-2'>
          <RadioGroupItem value='default' id={`${idPrefix}-default`} />
          <Label htmlFor={`${idPrefix}-default`}>Default</Label>
        </div>
        <div className='flex items-center space-x-2'>
          <RadioGroupItem value='offset' id={`${idPrefix}-offset`} />
          <Label htmlFor={`${idPrefix}-offset`}>Offset</Label>
        </div>
        <div className='flex items-center space-x-2'>
          <RadioGroupItem value='manual' id={`${idPrefix}-manual`} />
          <Label htmlFor={`${idPrefix}-manual`}>Manual</Label>
        </div>
      </RadioGroup>

      {type === 'offset' && (
        <div className='space-y-3'>
          <div className='flex flex-row justify-between items-start gap-2'>
            <Label>
              {offset > 0 ? '+' : offset < 0 ? '-' : ''}
              {hours > 0 ? `${hours.toString().padStart(2, '0')}h ` : ''}
              {minutes.toString().padStart(2, '0')}m
            </Label>
            <div className='flex items-center gap-1 text-xs'>
              <Minus className='h-3 w-3 text-muted-foreground' />
              <span className='text-muted-foreground'>Earlier</span>
              <span className='mx-1'>|</span>
              <span className='text-muted-foreground'>Later</span>
              <Plus className='h-3 w-3 text-muted-foreground' />
            </div>
          </div>
          <Slider
            value={[offset]}
            min={-120}
            max={120}
            step={1}
            onValueChange={v =>
              onOffsetChange ? onOffsetChange(v[0]) : onChange({ type: 'offset', offset: v[0] })
            }
          />
        </div>
      )}

      {type === 'manual' && (
        <div className='space-y-2'>
          <Label htmlFor={`${idPrefix}-manual-time`}>Select Time</Label>
          <TimePicker
            time={parseTimeString(manualTime)}
            setTime={t => {
              const formatted = formatTimeString(t);
              if (onManualTimeChange) onManualTimeChange(formatted);
              else onChange({ type: 'manual', manual_time: formatted });
            }}
            minuteInterval={1}
          />
        </div>
      )}
    </div>
  );
}
