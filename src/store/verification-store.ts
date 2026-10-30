import { create } from 'zustand';
import type { VerificationStore } from '@/types';

export const useVerificationStore = create<VerificationStore>()(set => ({
  verification: null,
  loadedFor: null,
  setVerification: (masjidId, verification) => set({ verification, loadedFor: masjidId }),
}));
