import { useEffect, useState } from 'react';
import { getContentNotificationStatus } from '@/lib/supabase';
import type { ContentNotificationStatus } from '@/types';

/** The masjid's content notification switches and how many it has sent today. */
export function useContentNotificationStatus() {
  const [status, setStatus] = useState<ContentNotificationStatus | null>(null);

  useEffect(() => {
    let active = true;
    getContentNotificationStatus()
      .then(result => active && setStatus(result))
      .catch(error => console.error('Error loading content notification status:', error));
    return () => {
      active = false;
    };
  }, []);

  return status;
}
