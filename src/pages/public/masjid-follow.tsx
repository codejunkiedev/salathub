import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { buttonVariants } from '@/components/ui';
import { getPublicMasjid, type PublicMasjid } from '@/lib/supabase';
import { ALKHAIRIA_PLAY_STORE_URL, masjidAppUrl } from '@/helpers';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Status = 'loading' | 'ready' | 'unavailable';

/**
 * Where a follow QR lands when the Alkhairia app did not take the link itself:
 * the app is missing, or is a build from before it claimed these links.
 */
export default function MasjidFollow() {
  const { id = '' } = useParams<{ id: string }>();
  const validId = UUID_PATTERN.test(id);
  const [masjid, setMasjid] = useState<PublicMasjid | null>(null);
  const [status, setStatus] = useState<Status>(validId ? 'loading' : 'unavailable');

  const isAndroid = /android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!validId) return;
    let cancelled = false;

    getPublicMasjid(id)
      .then(result => {
        if (cancelled) return;
        setMasjid(result);
        setStatus(result ? 'ready' : 'unavailable');
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Error loading masjid:', error);
        setStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [id, validId]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-background px-4 py-10'>
      <div className='w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 text-center shadow-sm'>
        {status === 'loading' && <div className='h-40 animate-pulse rounded-lg bg-muted' />}

        {status === 'unavailable' && (
          <div className='space-y-2'>
            <h1 className='text-xl font-semibold'>This masjid is not available</h1>
            <p className='text-sm text-muted-foreground'>
              It may have stopped sharing its prayer times in the Alkhairia app.
            </p>
          </div>
        )}

        {status === 'ready' && masjid && (
          <>
            <div className='space-y-3'>
              {masjid.logo_url && (
                <img
                  src={masjid.logo_url}
                  alt=''
                  className='mx-auto h-20 w-20 rounded-full object-cover'
                />
              )}
              <h1 className='text-xl font-semibold'>{masjid.name}</h1>
              {masjid.area && <p className='text-sm text-muted-foreground'>{masjid.area}</p>}
            </div>

            <p className='text-sm text-muted-foreground'>
              Follow this masjid in the Alkhairia app to see its prayer times and hear when they
              change.
            </p>

            <div className='space-y-3'>
              {isAndroid && (
                <a
                  href={masjidAppUrl(masjid.id)}
                  className={buttonVariants({ className: 'w-full' })}
                >
                  Open in Alkhairia
                </a>
              )}
              <a
                href={ALKHAIRIA_PLAY_STORE_URL}
                className={buttonVariants({
                  variant: isAndroid ? 'outline' : 'default',
                  className: 'w-full',
                })}
              >
                Get Alkhairia on Google Play
              </a>
              {!isAndroid && (
                <p className='text-xs text-muted-foreground'>
                  Alkhairia is available on Android for now.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
