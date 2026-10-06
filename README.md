# SalatHub

A mosque management and digital-signage platform. Admins and moderators manage prayer times and content from a web console; display screens around the masjid — TVs, tablets, phones — sign in with a per-screen code and render a full-screen, auto-rotating slideshow.

One React SPA, two runtime surfaces behind separate authentication realms:

| Surface              | Users                 | Sign-in                          | Session                                             |
| -------------------- | --------------------- | -------------------------------- | --------------------------------------------------- |
| Console (`/admin/*`) | Admins, moderators    | Email + password (Supabase Auth) | Supabase session + `auth` store                     |
| Display (`/`)        | Screens in the masjid | A per-screen code                | No Supabase session; code held in a persisted store |

The realms are independent, so one device can hold both at once. Each masjid is a tenant: a user belongs to exactly one masjid with a role of `admin` or `moderator`, enforced in the UI and again by Row-Level Security.

**Stack.** React 19 · TypeScript 5.8 · Vite 6 · React Router 7 · Tailwind 4 (compiled through PostCSS, not `@tailwindcss/vite`) · Radix UI · Zustand (persisted) · React Hook Form + Zod 3 · i18next (en/ur/ar) · Supabase (Auth, Postgres + RLS, Storage, Edge Functions, Realtime) · Leaflet · dnd-kit · react-moveable · html-to-image · Swiper 11 · date-fns 3 · Sentry · `vite-plugin-pwa`. Slide animations are hand-written CSS keyframes in `src/index.css` — Framer Motion was removed.

## Quick start

Requires **Node.js 20.18+** (CI builds on Node 20; `react-router` 7 needs `>=20.0.0` and `lint-staged` 16 needs `>=20.18`), a Supabase project with [`supabase/migrations/`](./supabase/migrations/) applied, and the Edge Functions in [`supabase/functions/`](./supabase/functions/) deployed.

```bash
git clone <repository-url>
cd salathub
npm ci --legacy-peer-deps   # the dependency tree has unresolved peer conflicts; CI uses this flag
npm run dev
```

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are needed to boot — see [Operations](docs/operations.md#environment-variables) for the full set and a security warning about the committed env files.

## Documentation

| Doc                                    | Covers                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Architecture](docs/architecture.md)   | Realms, routing and guards, data access, security, how displays and the mobile app read, realtime |
| [Database](docs/database.md)           | The thirteen tables, storage buckets, RLS posture                                                 |
| [Admin console](docs/admin-console.md) | Auth, roles, moderators, masjid profile, screen management                                        |
| [Content](docs/content.md)             | Announcements, events, posts, YouTube, the Ayat & Hadith designer                                 |
| [Prayer times](docs/prayer-times.md)   | The three-category model, solar times, timezone resolution, caching                               |
| [Display runtime](docs/display.md)     | Slide assembly, rotation, themes, weather, internationalization                                   |
| [Operations](docs/operations.md)       | Env vars, scripts, build, deployment, TV hardware, offline, monitoring                            |
| [Known issues](docs/known-issues.md)   | Open issues and dead code found while documenting                                                 |

## Contributing

Branch, commit, open a PR. Pre-commit hooks lint and format staged code; CI runs lint, `tsc --noEmit`, and a production build.

## License

Private and proprietary.
