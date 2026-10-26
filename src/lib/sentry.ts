import * as Sentry from '@sentry/react';
import type { Session } from '@supabase/supabase-js';
import type { MemberRole } from '@/types';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const environment = import.meta.env.MODE;
  const isProd = environment === 'production';

  Sentry.init({
    dsn,
    environment,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: isProd ? 0.1 : 1.0,
    tracePropagationTargets: [/^\/(?!\/)/, /^https:\/\/[^/]+\.supabase\.co\//],
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Sentry 11 collects everything when this is unset. Keep v10's defaults so
    // request bodies (passwords, auth tokens), cookies and IPs aren't sent.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      databaseQueryData: false,
    },
  });
}

type CaptureContext = {
  operation: string;
  source: 'supabase.postgrest' | 'supabase.auth' | 'supabase.storage' | 'supabase.functions';
  extra?: Record<string, unknown>;
};

export function captureSupabaseError(error: unknown, context: CaptureContext): void {
  Sentry.withScope(scope => {
    scope.setTag('source', context.source);
    scope.setTag('operation', context.operation);
    if (context.extra) scope.setExtras(context.extra);
    Sentry.captureException(error);
  });
}

type ExternalFetchSource = 'geoapify' | 'openweather' | 'aladhan' | 'hadith' | 'quran';

type ExternalFetchContext = {
  source: ExternalFetchSource;
  operation: string;
  extra?: Record<string, unknown>;
};

export function captureExternalFetchError(error: unknown, context: ExternalFetchContext): void {
  // Aborted fetches are normal user navigation/cancellation, not bugs.
  if (error instanceof DOMException && error.name === 'AbortError') return;
  Sentry.withScope(scope => {
    scope.setTag('source', context.source);
    scope.setTag('operation', context.operation);
    if (context.extra) scope.setExtras(context.extra);
    Sentry.captureException(error);
  });
}

export function identifySentryUser(
  session: Session,
  masjidId: string | null,
  role: MemberRole | null
): void {
  Sentry.setUser({
    id: session.user.id,
    email: session.user.email,
    masjid_id: masjidId ?? undefined,
    role: role ?? undefined,
  });
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
}

export { Sentry };
