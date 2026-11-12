# Database

Twenty-four tables in `public`. [`supabase/migrations/`](../supabase/migrations/) is authoritative — 80 files, applied in order, with several columns added and later dropped, so read the latest migration touching a table rather than the one that created it.

## Tables

| Table                                                         | Purpose                                                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `masjid_profiles`                                             | Tenant root. Name (+ `name_ur`/`name_ar`), area (+ `area_ur`/`area_ar`), logo, coordinates, contact number/email/website, a **required** IANA `timezone`, `listed` (the admin's opt-in) and `in_app` (what the app reads) |
| `masjid_members`                                              | Membership + `role`. `UNIQUE(user_id)` — a user belongs to one masjid                                                                                                                                                     |
| `display_screens`                                             | Per-screen code, orientation, theme, `custom_theme` JSON, language, slide interval, prayer/weather toggles, prayer-alert triggers and sound, and `paused_at` (over the plan's limit; only server-side code changes it)                                                                               |
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
| `masjid_content_notification_settings`                        | Per-masjid switches for which content types notify followers. Members (admins and moderators) write; defaults live in `content_notification_switches()` |
| `content_notification_queue`, `masjid_content_notifications`  | Items that just showed in the app for the first time, and the content notifications sent. Owned by `notify-content` |
| `platform_admins`                                             | Our team. Seeded by hand; no client role can read it. `is_platform_admin()` checks the caller                                                                                                                             |
| `masjid_verifications`                                        | One row per masjid: verification status, rejection reason, grace period and suspension. Members read their own; changed only through the functions below                                                                  |
| `verification_documents`                                      | Uploaded proof, stored in the private `verification-documents` bucket. Masjid admins and platform admins only                                                                                                             |
| `masjid_reports`                                              | Reports from app users on a masjid or feed item, one per device per item. Written through `masjid-directory`; platform admins read                                                                                        |
| `plan_rules`                                                  | What Free and Pro allow: screens included, announcement limit, feature keys. The one definition the console, screens and plan limits read |
| `masjid_billing`                                              | One row per masjid: plan, status, currency, extra screens, trial/renewal/grace dates, Stripe ids. Masjid admins and platform admins read; only the billing functions write |
| `stripe_events`                                               | Stripe webhook events already handled, so a redelivery is skipped. No client role can reach it |
| `masjid_billing_grants`                                       | Free Pro grants and trial extensions by our team, with who (`granted_by_email`), when and why. Platform admins read; written only by the functions below |
| `tax_exemption_certificates`                                  | Nonprofit sales tax certificates per US state: status, rejection reason, expiry. Masjid admins add and read their own; platform admins decide through `tax-exemptions` |

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
- `mark_app_shown()` — sets `app_shown_at` the first time an announcement, event or post is published, in the app and not removed, and queues it. `claim_content_notification()` applies the switches, `in_app` and a 5-in-24-hours limit separate from follower messages.
- `claim_masjid_notification()` — records a follower message under the 3-in-24-hours limit, locking the masjid row so concurrent sends can't both pass. `service_role` only. `count_masjid_followers()` gives members their masjid's subscribed device count.
- `search_masjids_nearby()` / `search_masjids_by_name()` / `get_masjids_public()` — the directory reads, granted to `service_role` alone. See [Architecture](./architecture.md#how-the-mobile-app-reads-data).
- `compute_masjid_in_app()` — a `BEFORE` trigger setting `in_app`: listed, verified or in grace, and not suspended. **Every app path reads `in_app`, never `listed`.** `sync_masjid_in_app()` re-runs it when a masjid's verification changes.
- `submit_masjid_verification()` (masjid admin), `decide_masjid_verification()`, `set_masjid_suspension()` and `resolve_masjid_report()` (platform admin) — the only writes to verification state. `submit_masjid_report()` is `service_role` only.
- `create_masjid_billing()` starts each new masjid on a 30-day Pro trial; `billing_currency_for_timezone()` picks PKR, CAD or USD from its timezone until it has a Stripe customer. `expire_masjid_billing()` moves expired trials and grace periods to Free, every 5 minutes (`expire-masjid-billing`). Hourly, `billing-jobs` sends the 7-day and 1-day trial reminders and the 30-day and 7-day reminders before free Pro ends, each recorded in its `*_reminder_*_at` column.
- `grant_masjid_pro()` (status `granted` until a date) and `extend_masjid_trial()` — platform admin only, each logged in `masjid_billing_grants`. Masjids that existed at launch were granted Pro until the end of 31 March 2027 in their own timezone.
- Plan limits (PB-87), all raising SQLSTATE `SH402` with a message the console shows: `masjid_plan_rules()` / `masjid_has_feature()` / `masjid_screen_limit()` read the plan; triggers refuse a screen over the limit, a Pro theme or weather on Free, new events/posts/YouTube videos, a 4th published announcement, new moderators and switching event/post notifications on. `sync_masjid_screen_pauses()` pauses screens over the limit (most recently picked `live_priority` first, then oldest) whenever the plan, extra screens or screens change. `get_user_masjid_id()` / `get_user_role()` see no masjid for a moderator on a plan without moderators; `get_my_membership()` tells the console why. `get_display_payload` and `get_masjid_feed` leave out what the plan doesn't include.
- Cron, both hourly: `expire-verification-grace`, and `verification-jobs`, which deletes documents 90 days after a decision and sends each masjid in grace one warning email (`grace_warned_at`).

Every `SECURITY DEFINER` function now pins `search_path`.

## RLS posture

- **Any member** may CRUD `announcements`, `events`, `posts`, `youtube_videos`, `ayat_and_hadith` within their masjid.
- **Members read, admins write** on `display_screens`, `screen_content`, `prayer_times`, `settings` and `masjid_profiles`. The exception is the `masjid_profiles` INSERT policy, which checks `user_id = auth.uid()` so a new user can create their first profile before any membership exists.
- **`anon` holds `SELECT` on exactly one table**, `display_revisions`, and `EXECUTE` on the five code-keyed functions. Everything else was revoked, and the directory added in `20260918000003` does not reopen it.

## Storage buckets

`masjid-logos`, `masjid-posts`, `ayat-hadith-slides` and `user-backgrounds` accept writes only under a `<masjid_id>/` path prefix. `assets` — the curated `predesigned-posts` and `ayat-hadith-backgrounds` libraries — is read-only to everyone but `service_role`.

Update and delete carry a legacy fallback matching on object ownership, because objects predating the scoping rule use older path shapes; the `WITH CHECK` still demands the new prefix, so touching an old object migrates it.

`verification-documents` is private: only the masjid's admins and platform admins can read it, and admins can add or remove files only before submitting or after a rejection. `tax-exemption-certificates` is private the same way; admins can add files but only remove one that never got its table row.

Public **listing** now requires authentication, but public **downloads** still bypass RLS entirely, which is why displays render every image without a key.
