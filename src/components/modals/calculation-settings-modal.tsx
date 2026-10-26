import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { Link } from 'react-router';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { AppRoutes, CalculationMethod, HijriCalculationMethod, JuristicSchool } from '@/constants';
import {
  getMasjidProfile,
  updateHijriSettings,
  updatePrayerCalculationSettings,
} from '@/lib/supabase';
import { useAdjustedHijriDate, useMasjidTimezone } from '@/hooks';
import { isNullOrUndefined } from '@/utils';
import type { Settings } from '@/types';

interface CalculationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings | null;
  onSettingsChange: (settings: Settings) => void;
}

const OFFSET_OPTIONS = [
  { value: -2, label: '-2 days' },
  { value: -1, label: '-1 day' },
  { value: 0, label: '0 days' },
  { value: 1, label: '+1 day' },
  { value: 2, label: '+2 days' },
];

export function CalculationSettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: CalculationSettingsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [calculationMethod, setCalculationMethod] = useState<number>(
    settings?.calculation_method ?? CalculationMethod.Muslim_World_League
  );
  const [juristicSchool, setJuristicSchool] = useState<number>(
    settings?.juristic_school ?? JuristicSchool.Shafi
  );
  const [hijriMethod, setHijriMethod] = useState<HijriCalculationMethod>(
    settings?.hijri_calculation_method ?? HijriCalculationMethod.Umm_al_Qura
  );
  const [hijriOffset, setHijriOffset] = useState<number>(settings?.hijri_offset ?? 0);

  const [masjidCoordinates, setMasjidCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const { timeZone } = useMasjidTimezone();
  const { adjustedHijriDate, isLoading: isLoadingAdjustedHijriDate } = useAdjustedHijriDate({
    calculationMethod: hijriMethod,
    offset: hijriOffset,
    timeZone,
  });

  const [prevSync, setPrevSync] = useState({ isOpen, settings });
  if (prevSync.isOpen !== isOpen || prevSync.settings !== settings) {
    setPrevSync({ isOpen, settings });
    if (isOpen) {
      if (!isNullOrUndefined(settings?.calculation_method)) {
        setCalculationMethod(settings.calculation_method);
      }
      if (!isNullOrUndefined(settings?.juristic_school)) {
        setJuristicSchool(settings.juristic_school);
      }
      if (settings?.hijri_calculation_method) {
        setHijriMethod(settings.hijri_calculation_method);
      }
      if (settings?.hijri_offset !== undefined) {
        setHijriOffset(settings.hijri_offset);
      }
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    getMasjidProfile()
      .then(profile => {
        if (!active) return;
        if (profile?.latitude && profile?.longitude) {
          setMasjidCoordinates({ latitude: profile.latitude, longitude: profile.longitude });
        }
      })
      .catch(error => console.error('Error fetching masjid profile:', error));
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      await updatePrayerCalculationSettings(calculationMethod, juristicSchool);
      const updated = await updateHijriSettings(hijriMethod, hijriOffset);
      onSettingsChange(updated);
      toast.success('Settings updated successfully');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && !isSubmitting && onClose()}>
      <DialogContent className='sm:max-w-[640px] max-w-[95vw] w-full max-h-[90vh] overflow-y-auto scrollbar-custom'>
        <DialogHeader>
          <DialogTitle>Calculation Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue='prayer' className='w-full'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='prayer'>Prayer</TabsTrigger>
            <TabsTrigger value='hijri'>Hijri</TabsTrigger>
          </TabsList>

          <TabsContent value='prayer' className='space-y-6 pt-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <Label className='block text-sm font-medium text-foreground mb-2'>
                  Calculation Method
                </Label>
                <Select
                  value={calculationMethod.toString()}
                  onValueChange={v => setCalculationMethod(parseInt(v))}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select calculation method' />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CalculationMethod)
                      .filter(([key]) => isNaN(Number(key)))
                      .map(([key, value]) => (
                        <SelectItem key={key} value={value.toString()}>
                          {key.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className='block text-sm font-medium text-foreground mb-2'>
                  Juristic School
                </Label>
                <Select
                  value={juristicSchool.toString()}
                  onValueChange={v => setJuristicSchool(parseInt(v))}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select juristic school' />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(JuristicSchool)
                      .filter(([key]) => isNaN(Number(key)))
                      .map(([key, value]) => (
                        <SelectItem key={key} value={value.toString()}>
                          {key}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center gap-2'>
                <MapPin size={16} />
                <Label>Masjid Location</Label>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <Label htmlFor='latitude' className='text-xs text-muted-foreground'>
                    Latitude
                  </Label>
                  <Input
                    id='latitude'
                    value={masjidCoordinates?.latitude.toFixed(3) || 'Not set'}
                    readOnly
                    className='bg-muted cursor-not-allowed'
                    autoFocus={false}
                  />
                </div>
                <div>
                  <Label htmlFor='longitude' className='text-xs text-muted-foreground'>
                    Longitude
                  </Label>
                  <Input
                    id='longitude'
                    value={masjidCoordinates?.longitude.toFixed(3) || 'Not set'}
                    readOnly
                    className='bg-muted cursor-not-allowed'
                    autoFocus={false}
                  />
                </div>
              </div>
              <p className='text-xs text-muted-foreground mt-1'>
                {masjidCoordinates
                  ? 'To update these coordinates, please visit the'
                  : 'To set these coordinates, please visit the'}{' '}
                <Link to={AppRoutes.SettingsProfile} className='text-primary hover:underline'>
                  Profile page
                </Link>
                .
              </p>
            </div>
          </TabsContent>

          <TabsContent value='hijri' className='space-y-4 pt-4'>
            <div className='flex items-center gap-2 text-sm'>
              <span className='text-muted-foreground'>Current Hijri Date:</span>
              {isLoadingAdjustedHijriDate ? (
                <span className='text-muted-foreground'>Calculating…</span>
              ) : (
                <span className='font-semibold'>{adjustedHijriDate || 'Unable to fetch date'}</span>
              )}
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <Label className='block text-sm font-medium text-foreground mb-2'>
                  Calculation Method
                </Label>
                <Select
                  value={hijriMethod}
                  onValueChange={v => setHijriMethod(v as HijriCalculationMethod)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(HijriCalculationMethod).map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {key.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className='block text-sm font-medium text-foreground mb-2'>
                  Date Offset
                </Label>
                <Select
                  value={hijriOffset.toString()}
                  onValueChange={v => setHijriOffset(parseInt(v))}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFSET_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className='flex flex-col sm:flex-row gap-2 sm:gap-0'>
          <Button
            type='button'
            variant='outline'
            onClick={onClose}
            disabled={isSubmitting}
            className='w-full sm:w-auto'
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={handleSave}
            loading={isSubmitting}
            disabled={isSubmitting}
            className='w-full sm:w-auto'
          >
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
