# SalatHub — Documentation

How each subsystem behaves, aimed at someone changing the code. The [root README](../README.md) covers what the product is and how to get it running. Paths are relative to `src/` unless stated.

## Start here

New to the codebase? Read [Architecture](./architecture.md) first — particularly _How displays read data_, which is the single most surprising part of the system and the thing most likely to mislead you if you assume a normal Supabase client setup.

| Doc                                 | Covers                                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Architecture](./architecture.md)   | Two realms, routes and guards, frontend composition, the data-access layer, RLS, the code-keyed display RPCs, realtime, repo layout |
| [Database](./database.md)           | Every table and what it is for, the masjid-keying rule, storage buckets and their write scoping                                     |
| [Admin console](./admin-console.md) | Sign-up and sign-in, the admin/moderator split, moderator lifecycle, masjid profile, display-screen management                      |
| [Content](./content.md)             | The shared content pattern, each type's fields and quirks, the post image pipeline, the Ayat & Hadith designer                      |
| [Prayer times](./prayer-times.md)   | Starts/athan/iqamah, offsets and manual times, Jumma variants, the four solar times, timezone resolution, month caching             |
| [Display runtime](./display.md)     | Slide assembly and rotation, prayer alerts, the four themes and the custom-theme engine, weather, internationalization              |
| [Operations](./operations.md)       | Environment variables, scripts, build config, deployment, TV-box hardware, service worker and caches, monitoring                    |
| [Known issues](./known-issues.md)   | Open issues and dead code, documented rather than fixed                                                                             |

## Conventions

- Prose explains mechanism; enumerable values point at source (`constants/config.ts`, `types/supabase.ts`) rather than being copied here, because copies go stale.
- Where a value is duplicated across TypeScript and SQL, the docs say so and name both sides — `DEFAULT_EVENT_DURATION_MINUTES` and `event_ends_at()` are the standing example.
- Behaviour that looks like a bug is recorded in [Known issues](./known-issues.md) rather than described as if intended.
