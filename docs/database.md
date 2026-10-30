# Database

Nineteen tables in `public`. [`supabase/migrations/`](../supabase/migrations/) is authoritative — 72 files, applied in order, with several columns added and later dropped, so read the latest migration touching a table rather than the one that created it.

## Tables

| Table                                                         | Purpose                                                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `masjid_profiles`                                             | Tenant root. Name (+ `name_ur`/`name_ar`), area (+ `area_ur`/`area_ar`), logo, coordinates, contact number/email/website, a **required** IANA `timezone`, `listed` (the admin's opt-in) and `in_app` (what the app reads) |
| `masjid_members`                                              | Membership + `role`. `UNIQUE(user_id)` — a user belongs to one masjid                                                                                                                                                     |
| `display_screens`                                             | Per-screen code, orientation, theme, `custom_theme` JSON, language, slide interval, prayer/weather toggles, prayer-alert triggers and sound                                                                               |
| `screen_content`                                              | Polymorphic playlist join with per-screen `display_order`. `content_id` has no FK by design; `get_display_payload` re-checks tenancy and drops drafts                                                                     |
| `announcements`, `posts`, `youtube_videos`, `ayat_and_hadith` | Content items, soft-deleted via `archived`. Null `published_at` is a draft                                                                                                                                                |
| `events`                                                      | As above, plus `date_time`/`end_time` as `timestamptz` and `ends_at`, a stored generated column backing the upcoming/past split                                                                                           |
| `prayer_times`                                                | Per-prayer `starts`/`athan`/`iqamah` adjustments as JSONB. One row per masjid (`UNIQUE(masjid_id)`)                                                                                                                       |
| `settings`                                                    | Calculation method, juristic school, Hijri method + offset, and four solar adjustments (sunrise, ishraq, chasht, sunset). One row per masjid                                                                              |
| `screen_heartbeats`                                           | `(screen_id, last_seen_at)`. Written only by an RPC; deliberately excluded from the realtime publication                                                                                                                  |
| `display_revisions`                                           | `(masjid_id, revision, updated_at)`. The content-free counter displays subscribe to                                                                                                                                       |
| `masjid_prayer_days`                                          | Resolved times, one row per masjid per masjid-local day. A cache the `masjid-directory` function owns; no client role can reach it                                                                                        |
| `push_devices`, `push_subscriptions`                          | Phones that opted into timing-change alerts, keyed by a random install id, and the masjids each follows. Written through `masjid-directory` only                                                                          |
| `masjid_prayer_changes`                                       | The queue of masjids due a comparison, each with its settings from before the first save. Owned by `notify-prayer-changes`                                                                                                |
| `masjid_notifications`                                        | Messages a masjid pushed to its followers, with sender and devices reached. Written by `notify-followers` only; members read their own masjid's                                                                           |
| `platform_admins`                                             | Our team. Seeded by hand; no client role can read it. `is_platform_admin()` checks the caller                                                                                                                             |
| `masjid_verifications`                                        | One row per masjid: verification status, rejection reason, grace period and suspension. Members read their own; changed only through the functions below                                                                  |
| `verification_documents`                                      | Uploaded proof, stored in the private `verification-documents` bucket. Masjid admins and platform admins only                                                                                                             |
| `masjid_reports`                                              | Reports from app users on a masjid or feed item, one per device per item. Written through `masjid-directory`; platform admins read                                                                                        |

On `prayer_times` and `settings`, `user_id` is nullable and `ON DELETE SET NULL` — it records who last saved the row, not who owns it, so deleting an account does not delete a masjid's prayer configuration. Both are keyed `UNIQUE(masjid_id)`; the earlier per-user keying is gone.

`ayat_and_hadith` was dropped and recreated with an entirely different shape, so its original columns (`text`, `translation`, `reference`) no longer exist — it now stores `source`, `cached_text` and `style` as JSONB plus a rendered `image_url`/`image_path`.

## Functions and triggers

Beyond the two RLS helpers and the display read functions covered in [Architecture](./architecture.md), note:

- `bump_display_revision()` — fires on all ten content and config tables to increment the realtime beacon.
- `handle_new_masjid_profile()` — the admin-bootstrap trigger, inserting an `admin` membership for whoever creates a profile.
- `event_ends_at(start, end)` — `COALESCE(end, start + INTERVAL '2 hours')`. Immutable because a generated column requires it, and **mirrored by `DEFAULT_EVENT_DURATION_MINUTES` in TypeScript — change both together.**
- `update_member_last_active()` — bumps `masjid_members.last_active_at` on any content mutation.
- `is_valid_timezone()` / `validate_masjid_timezone()` — a `BEFORE` trigger rejecting a `timezone` that is not in `pg_timezone_names`.
- `invalidate_masjid_prayer_days()` — drops a masjid's cached days whenever `settings`, `prayer_times` or its coordinates/timezone change. For a masjid with followers it first queues the masjid with its settings as they were before the save.
- `register_push_device()` / `claim_prayer_changes()` — the push registry write and the worker's queue claim, granted to `service_role` alone.
- `claim_masjid_notification()` — records a follower message under the 3-in-24-hours limit, locking the masjid row so concurrent sends can't both pass. `service_role` only. `count_masjid_followers()` gives members their masjid's subscribed device count.
- `search_masjids_nearby()` / `search_masjids_by_name()` / `get_masjids_public()` — the directory reads, granted to `service_role` alone. See [Architecture](./architecture.md#how-the-mobile-app-reads-data).
- `compute_masjid_in_app()` — a `BEFORE` trigger setting `in_app`: listed, verified or in grace, and not suspended. **Every app path reads `in_app`, never `listed`.** `sync_masjid_in_app()` re-runs it when a masjid's verification changes.
- `submit_masjid_verification()` (masjid admin), `decide_masjid_verification()`, `set_masjid_suspension()` and `resolve_masjid_report()` (platform admin) — the only writes to verification state. `submit_masjid_report()` is `service_role` only.
- Cron, both hourly: `expire-verification-grace`, and `verification-jobs`, which deletes documents 90 days after a decision and sends each masjid in grace one warning email (`grace_warned_at`).

Every `SECURITY DEFINER` function now pins `search_path`.

## RLS posture

- **Any member** may CRUD `announcements`, `events`, `posts`, `youtube_videos`, `ayat_and_hadith` within their masjid.
- **Members read, admins write** on `display_screens`, `screen_content`, `prayer_times`, `settings` and `masjid_profiles`. The exception is the `masjid_profiles` INSERT policy, which checks `user_id = auth.uid()` so a new user can create their first profile before any membership exists.
- **`anon` holds `SELECT` on exactly one table**, `display_revisions`, and `EXECUTE` on the five code-keyed functions. Everything else was revoked, and the directory added in `20260918000003` does not reopen it.

## Storage buckets

`masjid-logos`, `masjid-posts`, `ayat-hadith-slides` and `user-backgrounds` accept writes only under a `<masjid_id>/` path prefix. `assets` — the curated `predesigned-posts` and `ayat-hadith-backgrounds` libraries — is read-only to everyone but `service_role`.

Update and delete carry a legacy fallback matching on object ownership, because objects predating the scoping rule use older path shapes; the `WITH CHECK` still demands the new prefix, so touching an old object migrates it.

`verification-documents` is private: only the masjid's admins and platform admins can read it, and admins can add or remove files only before submitting or after a rejection.

Public **listing** now requires authentication, but public **downloads** still bypass RLS entirely, which is why displays render every image without a key.
