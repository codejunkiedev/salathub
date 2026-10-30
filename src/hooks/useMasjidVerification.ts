import { useCallback, useEffect } from 'react';
import { getMasjidVerification } from '@/lib/supabase';
import { useAuthStore, useVerificationStore } from '@/store';
import type { MasjidVerification } from '@/types';

type ReturnType = {
  verification: MasjidVerification | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

/**
 * The current masjid's verification status, shared between the console banner
 * and the verification page
 */
export function useMasjidVerification(): ReturnType {
  const masjidId = useAuthStore(s => s.masjidId);
  const { verification, loadedFor, setVerification } = useVerificationStore();

  const refresh = useCallback(async () => {
    if (!masjidId) return;
    try {
      setVerification(masjidId, await getMasjidVerification());
    } catch (error) {
      console.error('Error loading verification:', error);
    }
  }, [masjidId, setVerification]);

  useEffect(() => {
    if (masjidId && loadedFor !== masjidId) void refresh();
  }, [masjidId, loadedFor, refresh]);

  const isCurrent = !!masjidId && loadedFor === masjidId;
  return {
    verification: isCurrent ? verification : null,
    isLoading: !!masjidId && !isCurrent,
    refresh,
  };
}
