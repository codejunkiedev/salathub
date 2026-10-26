import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Switch,
} from '@/components/ui';
import { getMasjidProfile, setMasjidListed } from '@/lib/supabase';
import { PageHeader } from '@/components/common';
import { FollowQrPreview } from '@/components/settings';
import { AppRoutes } from '@/constants';
import type { MasjidProfile } from '@/types';

export default function AlkhairiaApp() {
  const [profile, setProfile] = useState<MasjidProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getMasjidProfile()
      .then(setProfile)
      .catch(error => {
        console.error('Error loading profile:', error);
        toast.error('Failed to load masjid profile');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const hasLocation = !!profile?.latitude && !!profile?.longitude;
  const listed = profile?.listed ?? false;

  const toggleListed = async (checked: boolean) => {
    try {
      setIsSaving(true);
      setProfile(await setMasjidListed(checked));
      toast.success(
        checked ? 'Masjid listed in the Alkhairia app' : 'Masjid removed from the Alkhairia app'
      );
    } catch (error) {
      console.error('Error updating listing:', error);
      toast.error('Failed to update listing');
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
        title='Alkhairia App'
        description='Let people find and follow the masjid in the Alkhairia mobile app'
      />

      {isLoading ? (
        <div className='animate-pulse bg-muted rounded-lg h-64'></div>
      ) : (
        <>
          <Card>
            <CardHeader>
              {/* Positioned so the hidden input Radix pairs with the Switch is
                  contained here; unanchored it resolves against the initial
                  containing block, escapes main's overflow and scrolls the page. */}
              <div className='relative flex items-start justify-between gap-4'>
                <div className='space-y-1.5'>
                  <CardTitle>
                    <label htmlFor='listed'>List this masjid in the Alkhairia app</label>
                  </CardTitle>
                  <CardDescription>
                    People nearby can find the masjid and follow it for prayer times. Doing so
                    publishes the masjid's name, area, logo, location and prayer timings, along with
                    any contact number, email and website in the masjid profile. Turn it off at any
                    time and the masjid stops appearing.
                  </CardDescription>
                </div>
                <Switch
                  id='listed'
                  checked={listed}
                  onCheckedChange={toggleListed}
                  disabled={isSaving || (!hasLocation && !listed)}
                />
              </div>
            </CardHeader>
            {!hasLocation && (
              <CardContent>
                <p className='text-sm text-muted-foreground'>
                  Set the masjid location in the{' '}
                  <Link
                    to={AppRoutes.SettingsProfile}
                    className='text-foreground underline underline-offset-2'
                  >
                    masjid profile
                  </Link>{' '}
                  first — the app finds masjids by distance.
                </p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className='flex items-start justify-between gap-4'>
                <div className='space-y-1.5'>
                  <CardTitle>Follow QR</CardTitle>
                  <CardDescription>
                    People scan the code with their phone to follow the masjid. Print the poster for
                    the entrance, or show the code on a display from the screen's settings.
                  </CardDescription>
                </div>
                {profile && listed && (
                  <FollowQrPreview masjidId={profile.id} masjidName={profile.name} />
                )}
              </div>
            </CardHeader>
            {!listed && (
              <CardContent>
                <p className='text-sm text-muted-foreground'>
                  Available once the masjid is listed.
                </p>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
