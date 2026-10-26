import { useCallback, useEffect, useState } from 'react';
import { listUserBackgrounds } from '@/lib/supabase';
import type { BackgroundImage } from '@/types';

/**
 * Loads the current masjid's uploaded background images. Mirrors
 * {@link useBackgroundImages} (curated library) but for per-masjid uploads, and
 * exposes `refetch` so callers can refresh the grid after an upload or delete.
 */
export function useUserBackgrounds() {
  const [images, setImages] = useState<BackgroundImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyResult = useCallback(
    (result: Promise<BackgroundImage[]>, isActive: () => boolean = () => true) => {
      return result
        .then(files => {
          if (!isActive()) return;
          setImages(files);
          setError(null);
        })
        .catch(err => {
          if (!isActive()) return;
          console.error('Failed to load uploaded backgrounds:', err);
          setError('Failed to load uploaded images');
        })
        .finally(() => {
          if (isActive()) setLoading(false);
        });
    },
    []
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    await applyResult(listUserBackgrounds());
  }, [applyResult]);

  useEffect(() => {
    let active = true;
    void applyResult(listUserBackgrounds(), () => active);
    return () => {
      active = false;
    };
  }, [applyResult]);

  return { images, loading, error, refetch };
}
