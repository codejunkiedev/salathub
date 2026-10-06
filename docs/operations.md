# Operations

Environment, build, deployment, the hardware displays run on, and what happens when the network goes away.

## Environment variables

Vite reads per-mode env files (`.env.development`, `.env.production`).

Only the two Supabase variables are needed to build and boot — CI proves it by building with nothing else set. The rest disable individual features when absent.

```env
# Required
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

# Feature-gated — the app runs without these, with that feature degraded
VITE_GEOAPIFY_API_KEY=        # map tiles, location search, timezone lookup
VITE_OPEN_WEATHER_API_KEY=    # weather slide
VITE_HADITH_API_KEY=          # hadith fetch + search in the designer

# Optional
VITE_SENTRY_DSN=              # unset disables Sentry entirely
VITE_SENTRY_RELEASE=          # used at runtime and as the build-time release name
```

**Build-only**, read by `vite.config.ts` and never bundled: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. All three must be set together — the same flag also gates `build.sourcemap`, so source maps are only emitted when Sentry upload is on.

**Edge Function secrets**, set with `supabase secrets set`: `PRAYER_CACHE_WARM_SECRET` authenticates calls to `warm-prayer-cache`, which refuses to run without it. `PRAYER_CHANGES_SECRET` does the same for `notify-prayer-changes`. `EXPO_ACCESS_TOKEN` is optional and only needed if push security is enabled on the Expo project. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.

**Vault secrets**, read by the `notify-prayer-changes` cron job: `project_url` (`https://<ref>.supabase.co`) and `prayer_changes_secret`, equal to `PRAYER_CHANGES_SECRET`. Create them once per project with `select vault.create_secret('<value>', '<name>');`. Until both exist the job's call fails and queued masjids wait.

**Edge Functions** read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase dashboard, not from `.env`.

Al-Adhan and AlQuran.cloud need no key.

> ⚠️ `.env.development` and `.env.production` are currently **tracked in git** and `.gitignore` has no `.env*` rule. `SENTRY_AUTH_TOKEN` is a write-scoped build secret that does not belong in the repository, and it is in history, so deleting the files does not un-leak it. Add `.env*` to `.gitignore`, `git rm --cached` both files, rotate the Sentry token, and commit a `.env.example` instead. The `VITE_*` keys ship inside the client bundle by design, so treat them as public and rate-limit them at the provider.

## Scripts

| Command                           | Description                                         |
| --------------------------------- | --------------------------------------------------- |
| `npm run dev`                     | Vite dev server                                     |
| `npm run build`                   | `tsc -b && vite build`                              |
| `npm run preview`                 | Serve the production build                          |
| `npm run lint`                    | ESLint (flat config, `eslint.config.js`)            |
| `npm run format` / `format:check` | Prettier write / check                              |
| `npm run prepare`                 | Installs Husky hooks; runs automatically on install |

`.husky/pre-commit` runs `npx lint-staged`, which applies `eslint --fix` and `prettier --write` to staged `*.{js,jsx,ts,tsx}`. CI (`.github/workflows/ci.yml`) additionally runs `npx tsc --noEmit`. **There is no test runner and there are no test files.**

## Build

An `es2015` target, Terser, and core-js polyfills via `@vitejs/plugin-legacy`. `@` aliases to `./src`.

### The support floor

The floor lives in exactly one place: the `browserslist` field in `package.json`, currently `chrome >= 83`. Neither `postcss.config.mjs` nor the `legacy()` call in `vite.config.ts` names a target — both fall back to that field. **Change the floor there and nowhere else.** The two pipelines held separate numbers once (PostCSS on `chrome >= 83`, the legacy plugin on `chrome >= 49`), and reconciling them onto a floor that was never checked against the deployed boxes is what broke the prayer display in the field.

Two things to know before moving it:

- **`chrome >= N` carries the whole constraint.** An `android >= N` clause looks like it pins an Android OS version but does not: browserslist’s `android` track runs 2.1 → 4.4.4 and then jumps straight to the current Chrome for Android, so any `android >= N` above 4.4 resolves to that single current version and constrains nothing. Both `android >= 5` and `android >= 12` were no-ops.
- **Chrome version, not Android version, is what matters**, and the mapping is not tight — a box’s WebView can sit far behind its OS if it never gets Play Store updates. Android 10 ships Chrome/WebView 83, which is where the current floor comes from.

Raising the floor changes what `postcss-preset-env` downlevels, and unsupported CSS fails **silently**: no build error, no console error, no Sentry event — the declaration is simply dropped and the layout quietly loses its spacing. The features the app actually depends on are therefore pinned `true` in `postcss.config.mjs` rather than left to the floor:

| Feature                         | Needs      | Why it is pinned                                                                                                                                                                                                                |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logical-properties-and-values` | Chrome 87  | Tailwind 4 compiles `px-*`/`py-*`/`mx-*`/`my-*`/`inset-*` to `padding-inline`, `padding-block`, `margin-inline`, `margin-block` and `inset`. Without the fallback, every one of those utilities is a no-op on an older WebView. |
| `is-pseudo-class`               | Chrome 88  | Tailwind’s preflight emits `:is()`; an unsupported selector drops the whole rule.                                                                                                                                               |
| `cascade-layers`                | Chrome 99  | Tailwind 4 is built on `@layer`.                                                                                                                                                                                                |
| `color-mix`, `oklab-function`   | Chrome 111 | Theme colours.                                                                                                                                                                                                                  |
| `nesting-rules`                 | Chrome 112 | Authored nesting in `src/index.css`.                                                                                                                                                                                            |

Pinned means they are downlevelled no matter where the floor sits, so moving the floor cannot silently delete a fallback again.

**Not covered by any of this:** the custom prayer-timings theme sizes itself with container-query units (`cqw`/`cqh`, `containerType: 'size'`), which need **Chrome 105** and have no fallback. That requirement is independent of the floor and is not enforced anywhere — on a box below 105 the custom theme loses its spacing regardless of these settings. Themes 1–3 use no container units.

Display components size themselves in viewport and container units, with `[@media(min-width:3000px)]` and `4000px` variants for 4K panels and `100dvh` with a `100vh` fallback for embedded browsers. These are arbitrary Tailwind variants, which is why they work with no config file: Tailwind 4 is configured entirely from `src/index.css`.

## Deployment

Vercel, as a static SPA build. `vercel.json` is only a catch-all rewrite to `/`; Vercel auto-detects Vite, and deployment runs through the Git integration — CI lints, type-checks, and builds but does not deploy.

The rewrite deliberately catches `/admin/*` too, which is why `index.html` carries an inline service-worker recovery script for non-display routes.

## Offline, service worker and caches

The service worker registers only on `/`, `/logout` and `/login-with-code`, and is proactively unregistered elsewhere so the console stays fresh.

Workbox precaches build assets and adds five runtime rules:

| Rule                     | Strategy             | Limits                |
| ------------------------ | -------------------- | --------------------- |
| Supabase storage         | CacheFirst           | 200 entries / 30 days |
| Al-Adhan                 | NetworkFirst, 8 s    | 50 / 35 days          |
| OpenWeather              | NetworkFirst, 6 s    | 20 / 1 day            |
| Google Fonts stylesheets | StaleWhileRevalidate | —                     |
| Google Fonts files       | CacheFirst           | 30 / 1 year           |

Updates are checked every 30 minutes and applied immediately. A `navigateFallback` to `/index.html` denylists `/admin`, `/login`, `/register` and `/forgot-password`.

A second recovery layer sits in `index.html` as an inline pre-module script: on any non-display path it unregisters every service worker, clears all Cache Storage and reloads — which is what rescues an admin from a stale worker serving an index with dead asset hashes.

**localStorage caches**, all versioned in the key, all swallowing quota errors, none with eviction beyond that version:

| Key                                                                        | Contents                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `display_data_cache_v1:<screenId>`                                         | Per-screen render payload                                                                                                            |
| `prayer_times_month_cache_v1:<lat>:<lon>:<method>:<school>:<year>:<month>` | A full month of times                                                                                                                |
| `weather_forecast_cache_v1`                                                | **One global slot** — stores lat/lon/language and returns null on mismatch, so only one combination is cached at a time, with no TTL |

Four further keys exist outside that scheme: `display` and `auth` (Zustand), `prayerbox-ui-theme`, and `sidebarCollapsed`.

## Monitoring

**Sentry** initializes first in `main.tsx` and is a complete no-op without `VITE_SENTRY_DSN`. Traces sample at 0.1 in production and 1.0 otherwise; session replay is off except on errors, where it is **unmasked** (`maskAllText: false`, `blockAllMedia: false`) — worth knowing before putting anything sensitive on screen.

Typed capture helpers tag Supabase, PostgREST, Auth, Storage, Functions, PWA and each external API. AbortErrors are skipped inside the external-fetch helper specifically, not globally; PostgREST `PGRST116` is suppressed. `identifySentryUser` attaches id, email, masjid id and role.

There is **no analytics of any kind** and no global `unhandledrejection` handler.

**Error boundary.** One top-level class boundary showing a recovery card. Stack details render in development only; in production the error and its component stack go to Sentry rather than to the screen.

**Theming and layout.** `ThemeProvider` wraps the whole app — display and legal routes included, not just the console — persisting to `prayerbox-ui-theme`, tracking OS changes live in `system` mode, and revealing via a View Transition that is skipped under `prefers-reduced-motion`. A collapsible persisted sidebar above 768 px and a mobile drawer carry role- and onboarding-aware items. User-facing errors mostly surface through `sonner` toasts.

## Display hardware

SalatHub runs fullscreen in a browser on a TV box. The Android version matters more than anything else, because it determines the Chrome/WebView version and therefore CSS support.

**Recommended when buying:** Android 12+, 2 GB RAM (4 GB recommended), an Ethernet port, HDMI 1080p.

This is purchasing advice, not what the build supports. The build floor is lower on purpose — see [The support floor](#the-support-floor) — because boxes already hung on walls are not all Android 12, and the T95 in the table below ships as low as Android 10. Do not raise the build floor to match this recommendation.

| Budget     | Android | Chipset | RAM/Storage | PKR          | USD    |
| ---------- | ------- | ------- | ----------- | ------------ | ------ |
| X96H       | 13      | H618    | 4 GB/64 GB  | 8,000–12,000 | $30–40 |
| T95 (H616) | 10–12   | H616    | 4 GB/32 GB  | 6,000–8,000  | $25–30 |
| H96 Max    | 12–13   | Various | 4 GB/32 GB  | 10,500       | $35    |

| Certified                   | OS            | RAM/Storage | PKR           | USD    |
| --------------------------- | ------------- | ----------- | ------------- | ------ |
| Xiaomi Mi Box S / TV Box S  | Google TV     | 2 GB/8 GB   | 12,000–15,000 | $50–60 |
| MECOOL KM2 Plus             | Android TV 12 | 2 GB/16 GB  | 15,000        | $88    |
| Amazon Fire TV Stick 4K Max | Fire OS       | 2 GB        | 8,000–10,000  | $35–50 |

Certified devices keep receiving Chrome/WebView updates, which matters for a display expected to run for years. Prefer a box over a stick for heat dissipation, and wired Ethernet over WiFi.

**Setup.** Install Chrome from the Play Store — the built-in browser on most boxes is too old. [Fully Kiosk Browser](https://www.fully-kiosk.com/) is worth installing on top: true fullscreen, auto-restart on crash, auto-launch on boot, and no way to navigate away by accident.

**Where to buy (Pakistan):** [Daraz.pk](https://www.daraz.pk/tag/android-tv-box-price/) · [AndroidBox.pk](https://androidbox.pk/) · [LAPTAB](https://www.laptab.com.pk/android-smart-tv-box/) · [W11Stop](https://w11stop.com/smart-tv-box-and-devices) · [OLX](https://www.olx.com.pk/items/q-android-tv-box)

**Known issues on Android 9 and below** (e.g. older X96Q): the prayer-timings screen scrolls because of a viewport-height miscalculation, `backdrop-filter: blur()` is unsupported so slides render blank, weather video backgrounds do not autoplay, and slide transitions stutter. Legacy polyfills and CSS fallbacks cover some of this, but a modern Android version is the real fix.
