import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DisplayStore } from '@/types';

export { useAuthStore } from './auth-store';
export { useVerificationStore } from './verification-store';
export { useBillingStore } from './billing-store';

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

// Keep tabs in step: when another tab signs a screen in or out, reload the
// persisted state here so the route guards redirect without a page reload,
// the way Supabase already syncs email sign-in across tabs.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === StorageKeys.Display || event.key === null) {
      void useDisplayStore.persist.rehydrate();
    }
  });
}
