import { useCallback, useEffect } from 'react';
import { getMasjidBilling } from '@/lib/supabase';
import { useAuthStore, useBillingStore } from '@/store';
import type { MasjidBilling } from '@/types';

type ReturnType = {
  billing: MasjidBilling | null;
  isLoading: boolean;
  refresh: () => Promise<MasjidBilling | null>;
};

/** The current masjid's plan, shared between the trial banner and the Billing page. Admins only. */
export function useMasjidBilling(): ReturnType {
  const masjidId = useAuthStore(s => s.masjidId);
  const isAdmin = useAuthStore(s => s.role) === 'admin';
  const { billing, loadedFor, setBilling } = useBillingStore();

  const refresh = useCallback(async () => {
    if (!masjidId || !isAdmin) return null;
    try {
      const loaded = await getMasjidBilling();
      setBilling(masjidId, loaded);
      return loaded;
    } catch (error) {
      console.error('Error loading billing:', error);
      return null;
    }
  }, [masjidId, isAdmin, setBilling]);

  useEffect(() => {
    if (masjidId && isAdmin && loadedFor !== masjidId) void refresh();
  }, [masjidId, isAdmin, loadedFor, refresh]);

  const isCurrent = !!masjidId && loadedFor === masjidId;
  return {
    billing: isCurrent ? billing : null,
    isLoading: isAdmin && !!masjidId && !isCurrent,
    refresh,
  };
}
