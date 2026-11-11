import { registerSW } from 'virtual:pwa-register';
import { AppRoutes, AuthRoutes, PublicRoutes } from '@/constants/routes';
import { useDisplayStore } from '@/store';
import { Sentry } from './sentry';

const DISPLAY_PATHS = new Set<string>([
  AppRoutes.Display,
  AppRoutes.DisplayLogout,
  AuthRoutes.LoginWithCode,
]);

function isDisplayPath(pathname: string): boolean {
  // A signed-in screen opening the root is about to be sent on to the display.
  if (pathname === PublicRoutes.Landing) return useDisplayStore.getState().loggedIn;
  return DISPLAY_PATHS.has(pathname);
}

// Kiosks may stay open for days. Check for a new service worker every 30 min
// so deploys show up without waiting for the next manual navigation.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function registerServiceWorker(): void {
  if (!isDisplayPath(window.location.pathname)) {
    void unregisterServiceWorker();
    return;
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        // Routine probe — offline kiosks will reject here, which is expected.
        // Real registration failures surface via onRegisterError on app boot.
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      Sentry.withScope(scope => {
        scope.setTag('source', 'pwa');
        scope.setTag('operation', 'register_service_worker');
        Sentry.captureException(error);
      });
    },
  });
}

async function unregisterServiceWorker(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (error) {
    Sentry.withScope(scope => {
      scope.setTag('source', 'pwa');
      scope.setTag('operation', 'unregister_service_worker');
      Sentry.captureException(error);
    });
  }
}
