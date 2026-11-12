import { create } from 'zustand';
import type { BillingStore } from '@/types';

export const useBillingStore = create<BillingStore>()(set => ({
  billing: null,
  loadedFor: null,
  setBilling: (masjidId, billing) => set({ billing, loadedFor: masjidId }),
}));
