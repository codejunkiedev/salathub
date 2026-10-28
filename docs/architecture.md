# Architecture

How the app is composed, how it is secured, and how the two runtime surfaces get their data.

## Two realms

| Realm   | Routes         | Sign-in         | Store                                                    |
| ------- | -------------- | --------------- | -------------------------------------------------------- |
| Console | `/admin/*`     | Supabase Auth   | `auth` → `{ masjidId, role }`                            |
| Display | `/`, `/logout` | Per-screen code | `display` → `{ loggedIn, masjidProfile, displayScreen }` |

Tracked independently, so one device can hold both. A user belongs to exactly one masjid — `masjid_members` is `UNIQUE(user_id)` — with role `admin` or `moderator`.

A masjid owns any number of screens, each with its own code, orientation, theme, language, slide interval, and independently ordered set of assigned content, so the same announcement can sit in a different position on each screen.

## Routes and guards

**Routes** (`constants/routes.ts`, three enums). Public `/privacy`, `/terms`. Auth `/login`, `/register`, `/forgot-password`, `/login-with-code`. Console `/admin` plus `announcements`, `events`, `posts`, `youtube-videos`, `ayat-and-hadith` (+ `/new`, `/:id/edit`), `prayer-timings`, `screens` (+ `/:id`, `/:id/customize-theme`), `settings` (+ `/profile`, `/account`), `moderators`, `support`, `reset-password`.

**Guards** (`navigation/index.tsx`). Every `/admin/*` route needs a session. `RequireAdmin` additionally wraps Screens, Screen Detail, the custom-theme editor, Prayer Timings, Settings, Settings Profile, Moderators and Support, redirecting moderators to `/admin`. Content pages are open to moderators. Auth routes redirect away when a session exists; the catch-all lands on `/admin` or `/` depending on session. All 28 pages are `React.lazy` behind one Suspense fallback.

Three routes render outside `AppLayout`, with no sidebar or header: the two designer routes and the custom-theme editor.

## Frontend composition

`main.tsx` initializes i18n, Sentry, and the service worker, then renders `App` — an `ErrorBoundary` and `ThemeProvider` around `Navigation`, which holds every route and guard. Two persisted Zustand stores hold identity: `auth` for the console and the display store for screens.

## Data access

Domain services in `lib/supabase/services/` sit on generic query helpers in `lib/supabase/helpers.ts`. Types in `types/supabase.ts` are **hand-written, not generated**, and every result is cast — so schema drift is invisible at compile time. Any migration that changes a column's shape has to be mirrored here by hand.

## Security

Row-Level Security scopes every authenticated query through two `SECURITY DEFINER` SQL helpers, `get_user_masjid_id()` and `get_user_role()`, both with a pinned `search_path`. Members can CRUD content; admin-only surfaces (screens, prayer config, settings, profile, members) additionally require `get_user_role() = 'admin'`.

Moderator lifecycle runs through service-role Edge Functions, which verify the caller is an admin of the same masjid, that the target is a moderator in that masjid, and refuse to act on an admin. See [Admin console](./admin-console.md#moderators).

## How displays read data

This is the part most likely to trip you up, because it does not look like a normal Supabase client.

A display holds **no Supabase session** and runs as `anon`, which has **no `SELECT` on any content table**. The grants were revoked, not merely the policies dropped — which matters, because Postgres needs `SELECT` on a column to reference it in a `WHERE` clause, so a `?code=eq.X` filter cannot resolve through a table either.

Everything arrives through `SECURITY DEFINER` functions keyed by the screen's login code, which acts as a bearer credential: checkable, never listable, and pinned to the one masjid owning that screen.

| Function                              | Returns                                                                                                                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_display_session(p_code)`         | `{ screen, masjid_profile }` — backs code login                                                                                                                                  |
| `get_display_payload(p_code)`         | The whole render set in one round trip: screen, profile, `settings`, `prayer_times`, the visible playlist ordered by `display_order`, and a map of the content rows it points at |
| `get_display_prayer_settings(p_code)` | `{ settings, prayer_times }` for the prayer-times hook alone                                                                                                                     |
| `record_screen_heartbeat(p_code)`     | Stamps `screen_heartbeats.last_seen_at`                                                                                                                                          |
| `verify_screen_code(p_code)`          | A bare existence check for the TV shell; not called by this web bundle                                                                                                           |

Inside `get_display_payload` every content branch re-checks `masjid_id` against the screen's own and filters `archived = false`, with events additionally filtered by `ends_at >= now()`. The re-check is necessary because `screen_content.content_id` deliberately carries no foreign key. A null payload means the screen row is gone, and the display signs itself out.

## How the mobile app reads data

The Alkhairia mobile app follows masjids and shows their times. It holds no session and gets nothing through PostgREST: everything arrives through the `masjid-directory` Edge Function, which runs as `service_role` and is the only door a public request comes through — one place for the rate limit and the column whitelist, and no new grant for `anon`.

A masjid appears only once an admin sets `masjid_profiles.listed`, which the Alkhairia App settings page gates on coordinates being present and a `CHECK` enforces.

| Route                             | Returns                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/nearby?lat&lng&radius_km&limit` | Listed masjids inside the radius, nearest first — bounding box against the partial index, then haversine |
| `/search?q&lat&lng`               | The same projection matched on name or area, in any of the three languages                               |
| `/masjids?ids=`                   | A phone's followed list in one round trip                                                                |
| `/timings?masjid_id&from&to`      | Resolved days for a window, defaulting to today plus a week in the masjid's own timezone                 |

Times are resolved **server-side** and cached in `masjid_prayer_days` — see [Prayer times](./prayer-times.md#server-side-resolution).

## Realtime

Because Realtime evaluates the **subscriber's** RLS before delivering a row, those revoked grants would silence any subscription to the content tables. So the ten per-table subscriptions collapsed into one on `display_revisions` — a content-free counter, one row per masjid, bumped by a trigger on every write to `masjid_profiles`, `display_screens`, `screen_content`, `settings`, `prayer_times`, `announcements`, `events`, `posts`, `youtube_videos` and `ayat_and_hadith`.

It is the only table `anon` can still read, and **its value is never used** — the beacon is purely a signal to refetch. Both display hooks subscribe filtered by `masjid_id` and debounce 250 ms, so a burst such as a drag-reorder coalesces into one refetch.

**Heartbeats** are deliberately separate: stamped on mount and every 15 minutes, failures ignored. `screen_heartbeats` is kept out of the realtime publication and off `display_screens` so frequent writes neither wake every live screen nor rewrite the `custom_theme` blob.

## External APIs

All in `src/api/`, all abortable and Sentry-instrumented: Al-Adhan (`/calendar`, `/timings`, `/gToH`), OpenWeather (`/forecast`, metric), Geoapify (geocoding, tiles, timezone lookup), AlQuran.cloud, hadithapi.com.

## Repository layout

```
src/
├── api/                # External API clients (aladhan, openweather, geoapify, quran, hadith)
├── assets/
│   ├── backgrounds/    # Designer backgrounds + weather art (landscape/ portrait/)
│   ├── fonts/          # Barlow, Clash Display/Grotesk, DS-Digital
│   ├── icons/weather/  # Condition-keyed SVG icons
│   └── themes/         # theme-1..3 decorative art
├── components/
│   ├── ui/             # Base primitives (Button, Input, Dialog, Map, TimezonePicker, ...)
│   ├── common/         # Shared widgets (DataTable, BackgroundControl, ImageTile, ...)
│   ├── ayat-hadith-designer/  # Canvas, content/design panels, hadith search
│   │   └── layers/            #   text / reference / overlay layer primitives
│   ├── display/        # Display-mode slides
│   │   ├── prayer-timings/     #   theme dispatcher
│   │   │   └── themes/         #     theme-1..3 + custom/ (Theme 4)
│   │   │       └── custom/layouts/  #   table, cards, spotlight
│   │   ├── weather/ youtube-videos/ announcements/ events/ posts/ ayat-hadith/ logout/
│   │   └── shared/            #   DisplayContainer, DisplayCard, CurrentTime, ...
│   ├── settings/       # Theme + custom-theme editors, app-theme
│   ├── prayer-times/   # Admin prayer-times table & states
│   ├── modals/         # Entity modals
│   │   └── post-modal/        #   orientation → source → form flow
│   ├── home/ layout/ skeletons/
│   └── error-boundary.tsx  auto-redirect-notice.tsx
├── constants/          # Routes, config enums, quran/hadith/custom-theme/slide-design
├── helpers/            # Background, font, custom-theme & localized-field resolution
├── hooks/              # Prayer/weather/display data, realtime, wake lock, heartbeat, ...
├── i18n/               # i18next setup, formatters, weather-condition keys
│   └── locales/        #   en.json, ur.json, ar.json
├── lib/
│   ├── supabase/       # Client, helpers, realtime, per-entity services/
│   └── sentry.ts  pwa.ts  zod.ts
├── navigation/         # Router + auth/role guards
├── pages/
│   ├── auth/           # Login, Register, Forgot Password, Login with Code
│   ├── app/            # Admin pages, Display, designer, editors, support, moderators
│   │   └── settings/   #   index, profile, account
│   └── legal/          # Privacy Policy, Terms & Conditions
├── providers/          # ThemeProvider (dark/light/system)
├── store/              # auth-store.ts + the display store in index.ts
├── types/              # Hand-written types (api/, supabase, common, store, validation, *.d.ts)
├── utils/              # date/time, timezone, prayer adjustments, image resize, caches, ...
└── App.tsx  main.tsx  index.css  vite-env.d.ts

supabase/
├── migrations/         # 54 migrations — schema, RLS, buckets, realtime, display + directory reads
├── functions/          # Edge Functions (moderators, masjid-directory, warm-prayer-cache)
│   └── _shared/        #   prayer-engine (generated), aladhan, masjid-timings
├── scripts/            # backfill-masjid-timezones.mjs, sync-prayer-engine.mjs
├── config.toml
└── verify-anon-lockdown.sh   # asserts the anon lockdown against a live project
```
