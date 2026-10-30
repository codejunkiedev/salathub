import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthStore } from '@/types';

enum StorageKeys {
  Auth = 'auth',
}

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      masjidId: null,
      role: null,
      isPlatformAdmin: false,
      setAuth: (masjidId, role) => set({ masjidId, role }),
      setPlatformAdmin: isPlatformAdmin => set({ isPlatformAdmin }),
      clearAuth: () => set({ masjidId: null, role: null, isPlatformAdmin: false }),
    }),
    { name: StorageKeys.Auth, storage: createJSONStorage(() => localStorage) }
  )
);
