import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  TimezonePicker,
} from '@/components/ui';
import {
  masjidProfileSchema,
  type MasjidProfileData,
  VALID_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/zod';
import { getMasjidProfile, upsertMasjidProfile } from '@/lib/supabase';
import { resolveTimezoneFromCoordinates } from '@/api';
import { toast } from 'sonner';
import { MapPin, ArrowLeft, X } from 'lucide-react';
import { useTrigger } from '@/hooks';
import { MapModal } from '@/components/modals';
import { PageHeader } from '@/components/common';
import { AppRoutes } from '@/constants';
import { useAuthStore } from '@/store';

export default function Profile() {
  const [masjidLogo, setMasjidLogo] = useState<File | null>(null);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isResolvingTimezone, setIsResolvingTimezone] = useState(false);

  const [trigger, triggerUpdate] = useTrigger();
  const navigate = useNavigate();
  const isNewMasjid = !useAuthStore(s => s.masjidId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    control,
  } = useForm<MasjidProfileData>({
    resolver: zodResolver(masjidProfileSchema),
    defaultValues: {
      name: '',
      name_ur: '',
      name_ar: '',
      area: '',
      area_ur: '',
      area_ar: '',
      latitude: 0,
      longitude: 0,
      timezone: '',
      contact_number: '',
      contact_email: '',
      website: '',
    },
  });

  const latitude = useWatch({ control, name: 'latitude' });
  const longitude = useWatch({ control, name: 'longitude' });
  const timezone = useWatch({ control, name: 'timezone' });
  const coordinates = latitude && longitude ? { latitude, longitude } : null;

  const deriveTimezone = useCallback(
    async (lat: number, lng: number) => {
      try {
        setIsResolvingTimezone(true);
        const resolved = await resolveTimezoneFromCoordinates({ latitude: lat, longitude: lng });
        if (resolved) setValue('timezone', resolved, { shouldValidate: true });
        else toast.warning('Could not determine the timezone for that location, please pick one');
      } catch (error) {
        console.error('Error resolving timezone:', error);
        toast.warning('Could not determine the timezone for that location, please pick one');
      } finally {
        setIsResolvingTimezone(false);
      }
    },
    [setValue]
  );

  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true);
        const profile = await getMasjidProfile();

        if (profile) {
          reset({
            name: profile.name,
            name_ur: profile.name_ur || '',
            name_ar: profile.name_ar || '',
            area: profile.area || '',
            area_ur: profile.area_ur || '',
            area_ar: profile.area_ar || '',
            latitude: profile.latitude || 0,
            longitude: profile.longitude || 0,
            timezone: profile.timezone || '',
            contact_number: profile.contact_number || '',
            contact_email: profile.contact_email || '',
            website: profile.website || '',
          });

          // Offer a derived zone for a profile saved before the field existed
          if (!profile.timezone && profile.latitude && profile.longitude) {
            void deriveTimezone(profile.latitude, profile.longitude);
          }

          if (profile.logo_url) {
            setPreviewLogo(profile.logo_url);
            setLogoRemoved(false);
          } else {
            setPreviewLogo(null);
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [reset, trigger, deriveTimezone]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, GIF, WEBP)');
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error('File size exceeds 5MB limit');
        return;
      }

      setMasjidLogo(file);
      if (logoRemoved) setLogoRemoved(false);

      const reader = new FileReader();
      reader.onload = () => {
        setPreviewLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetLogo = () => {
    setMasjidLogo(null);
    setPreviewLogo(null);
    setLogoRemoved(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCoordinatesSelect = (latitude: number, longitude: number) => {
    setValue('latitude', latitude);
    setValue('longitude', longitude);
    // The dev-only reset button clears the pin by passing nulls through
    if (latitude && longitude) void deriveTimezone(latitude, longitude);
  };

  const onSubmit = async (data: MasjidProfileData) => {
    try {
      setIsSaving(true);
      await upsertMasjidProfile(data, masjidLogo, logoRemoved);
      toast.success('Masjid profile saved successfully');
      if (isNewMasjid) {
        navigate(`${AppRoutes.SettingsVerification}?setup=1`);
        return;
      }
      triggerUpdate();
      if (logoRemoved) setLogoRemoved(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='container mx-auto py-8 space-y-6'>
      <div className='flex items-center gap-4'>
        <Link to={AppRoutes.Settings}>
          <Button variant='ghost' size='sm'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Settings
          </Button>
        </Link>
      </div>
      <PageHeader
        title='Masjid Profile'
        description='Manage masjid profile information, logo, and location'
      />

      {isLoading ? (
        <div className='animate-pulse bg-muted rounded-lg h-96'></div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Manage your masjid's profile information, logo, and location settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <label htmlFor='name' className='block text-sm font-medium text-foreground'>
                    Masjid Name
                  </label>
                  <Input
                    id='name'
                    {...register('name')}
                    placeholder='Enter masjid name'
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className='text-red-500 text-sm mt-1'>{errors.name.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <label htmlFor='name_ur' className='block text-sm font-medium text-foreground'>
                    Masjid Name (Urdu)
                    <span className='ml-2 text-xs text-muted-foreground font-normal'>Optional</span>
                  </label>
                  <Input
                    id='name_ur'
                    {...register('name_ur')}
                    dir='rtl'
                    lang='ur'
                    placeholder='مثلاً مسجد الفلاح'
                    className='font-urdu text-right'
                  />
                </div>

                <div className='space-y-2'>
                  <label htmlFor='name_ar' className='block text-sm font-medium text-foreground'>
                    Masjid Name (Arabic)
                    <span className='ml-2 text-xs text-muted-foreground font-normal'>Optional</span>
                  </label>
                  <Input
                    id='name_ar'
                    {...register('name_ar')}
                    dir='rtl'
                    lang='ar'
                    placeholder='مثال: مسجد الفلاح'
                    className='font-arabic text-right'
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <label htmlFor='area' className='block text-sm font-medium text-foreground'>
                    Area
                  </label>
                  <Input
                    id='area'
                    {...register('area')}
                    placeholder='e.g. Gulshan-e-Iqbal, Karachi'
                    className={errors.area ? 'border-red-500' : ''}
                  />
                  {errors.area && (
                    <p className='text-red-500 text-sm mt-1'>{errors.area.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <label htmlFor='area_ur' className='block text-sm font-medium text-foreground'>
                    Area (Urdu)
                    <span className='ml-2 text-xs text-muted-foreground font-normal'>Optional</span>
                  </label>
                  <Input
                    id='area_ur'
                    {...register('area_ur')}
                    dir='rtl'
                    lang='ur'
                    placeholder='مثلاً گلشنِ اقبال، کراچی'
                    className='font-urdu text-right'
                  />
                </div>

                <div className='space-y-2'>
                  <label htmlFor='area_ar' className='block text-sm font-medium text-foreground'>
                    Area (Arabic)
                    <span className='ml-2 text-xs text-muted-foreground font-normal'>Optional</span>
                  </label>
                  <Input
                    id='area_ar'
                    {...register('area_ar')}
                    dir='rtl'
                    lang='ar'
                    placeholder='مثال: حي جلشن إقبال، كراتشي'
                    className='font-arabic text-right'
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 items-start'>
                <div className='space-y-2'>
                  <label htmlFor='location' className='block text-sm font-medium text-foreground'>
                    Masjid Location
                  </label>
                  <div className='flex gap-2'>
                    <Input
                      id='location'
                      placeholder='Select location on map'
                      readOnly
                      value={
                        coordinates
                          ? `${coordinates.latitude.toFixed(3)}, ${coordinates.longitude.toFixed(3)}`
                          : ''
                      }
                      className='bg-muted cursor-not-allowed flex-1'
                    />
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setIsMapModalOpen(true)}
                      className='flex items-center gap-2 shrink-0'
                    >
                      <MapPin size={16} />
                      {coordinates ? 'Change' : 'Set'}
                    </Button>
                  </div>
                  {(errors.latitude || errors.longitude) && (
                    <p className='text-red-500 text-sm mt-1'>Masjid location is required</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <label htmlFor='timezone' className='block text-sm font-medium text-foreground'>
                    Timezone
                  </label>
                  <TimezonePicker
                    value={timezone}
                    onChange={value => setValue('timezone', value, { shouldValidate: true })}
                    disabled={isResolvingTimezone}
                    invalid={!!errors.timezone}
                  />
                  {errors.timezone && (
                    <p className='text-red-500 text-sm mt-1'>{errors.timezone.message}</p>
                  )}
                </div>
              </div>

              <p className='text-sm text-muted-foreground -mt-2'>
                {isResolvingTimezone
                  ? 'Working out the timezone for this location...'
                  : 'The timezone is set from the location. Event dates and times are shown in it on every screen and device, wherever they are being viewed from.'}
              </p>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-start'>
                <div className='space-y-2'>
                  <label
                    htmlFor='contact_number'
                    className='block text-sm font-medium text-foreground'
                  >
                    Contact Number
                    <span className='ml-2 text-xs text-muted-foreground font-normal'>Optional</span>
                  </label>
                  <Input
                    id='contact_number'
                    type='tel'
                    {...register('contact_number')}
                    placeholder='e.g. +92 300 1234567'
                    className={errors.contact_number ? 'border-red-500' : ''}
                  />
                  {errors.contact_number && (
                    <p className='text-red-500 text-sm mt-1'>{errors.contact_number.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <label
                    htmlFor='contact_email'
                    className='block text-sm font-medium text-foreground'
                  >
                    Contact Email
                    <span className='ml-2 text-xs text-muted-foreground font-normal'>Optional</span>
                  </label>
                  <Input
                    id='contact_email'
                    type='email'
                    {...register('contact_email')}
                    placeholder='e.g. info@masjid.org'
                    className={errors.contact_email ? 'border-red-500' : ''}
                  />
                  {errors.contact_email && (
                    <p className='text-red-500 text-sm mt-1'>{errors.contact_email.message}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <label htmlFor='website' className='block text-sm font-medium text-foreground'>
                    Website
                    <span className='ml-2 text-xs text-muted-foreground font-normal'>Optional</span>
                  </label>
                  <Input
                    id='website'
                    type='url'
                    {...register('website')}
                    placeholder='e.g. https://masjid.org'
                    className={errors.website ? 'border-red-500' : ''}
                  />
                  {errors.website && (
                    <p className='text-red-500 text-sm mt-1'>{errors.website.message}</p>
                  )}
                </div>
              </div>

              <div className='space-y-2'>
                <label htmlFor='masjid-logo' className='block text-sm font-medium text-foreground'>
                  Masjid Logo
                </label>
                <div className='flex items-start gap-4'>
                  <div className='flex-1'>
                    <Input
                      id='masjid-logo'
                      ref={fileInputRef}
                      type='file'
                      accept='image/*'
                      onChange={handleLogoChange}
                      className='cursor-pointer'
                    />
                    <p className='text-sm text-muted-foreground mt-1'>
                      Accepted formats: JPEG, PNG, GIF, WEBP (max 5MB)
                    </p>
                  </div>
                  {previewLogo && (
                    <div className='w-24 h-24 rounded overflow-hidden border relative'>
                      <button
                        type='button'
                        onClick={resetLogo}
                        className='absolute top-0 right-0 bg-black bg-opacity-50 text-white p-1 rounded-bl-md hover:bg-opacity-70'
                        aria-label='Remove logo'
                      >
                        <X size={16} />
                      </button>
                      <img
                        src={previewLogo}
                        alt='Logo preview'
                        className='w-full h-full object-cover'
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className='flex items-center gap-4'>
                <Button type='submit' loading={isSaving} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </Button>
                {isSaving && (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <div className='animate-spin h-4 w-4 border-2 border-muted border-t-foreground rounded-full'></div>
                    Saving settings...
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <MapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onCoordinatesSelect={handleCoordinatesSelect}
        coordinates={coordinates}
      />
    </div>
  );
}
