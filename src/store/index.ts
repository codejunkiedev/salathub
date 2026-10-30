import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DisplayStore } from '@/types';

export { useAuthStore } from './auth-store';
export { useVerificationStore } from './verification-store';

enum StorageKeys {
  Display = 'display',
}

const storage = createJSONStorage(() => localStorage);

export const useDisplayStore = create<DisplayStore>()(
  persist(
    set => ({
      loggedIn: false,
      setLoggedIn: loggedIn => set({ loggedIn }),
      masjidProfile: null,
      setMasjidProfile: masjidProfile => set({ masjidProfile }),
      displayScreen: null,
      setDisplayScreen: displayScreen => set({ displayScreen }),
      signOut: () => set({ loggedIn: false, masjidProfile: null, displayScreen: null }),
    }),
    { name: StorageKeys.Display, storage }
  )
);
