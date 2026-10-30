# Admin console

Authentication, the role split, and the two admin-only configuration surfaces. Content management lives in [Content](./content.md); prayer configuration in [Prayer times](./prayer-times.md).

## Authentication

Sign-up takes email, password (Zod minimum: 8 characters) and a confirmation, with a live strength meter — six checks scored 0–5, advisory only, so Zod's 8-character floor is the real rule (`utils/password-strength.ts`). Forgot-password mails a link to `/admin/reset-password`; that page redirects home 5 s after success.

HTTP 400/422/429 auth errors are ordinary user mistakes — wrong password, already registered, rate limited — and are deliberately not reported to Sentry (`lib/supabase/helpers.ts`).

**Account** (`/admin/settings/account`): change email via confirmation link; change password re-verified against the current one.

**Display login.** `/login-with-code` calls `getDisplaySession(code)` → the `get_display_session` RPC, which returns `{ screen, masjid_profile }` in one server-side call. `?code=CODE` auto-signs-in once behind a ref guard, so a device can be provisioned by URL.

## Roles

Admins do everything. Moderators manage content only — announcements, events, posts, YouTube videos, ayat & hadith, and follower notifications — enforced client-side by `RequireAdmin` and a role-aware sidebar, and server-side by RLS granting content CRUD to any member while restricting admin tables to `get_user_role() = 'admin'`.

**Bootstrap.** Creating a masjid profile fires `on_masjid_profile_insert` → `handle_new_masjid_profile()`, which inserts an `admin` membership for the creator; the client mirrors it. A signed-up user with no membership gets a transient admin with `masjidId: null` so onboarding is reachable — during which the sidebar shows only Home, plus Settings for admins.

## Moderators

`/admin/moderators`, admin-only. There is no invite flow: the admin creates a credentialed account outright. Each action is a service-role Edge Function that verifies the caller is an admin of the same masjid, that the target is a moderator in that masjid, and refuses to touch an admin.

| Function                   | Action                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `create-moderator`         | Creates the auth user (email pre-confirmed) + membership; deletes the user if the membership insert fails |
| `get-moderators`           | Lists the masjid's moderators, enriched with email                                                        |
| `update-moderator`         | Name and/or email                                                                                         |
| `reset-moderator-password` | Sets a new password                                                                                       |
| `revoke-moderator`         | Deletes membership then the auth user, invalidating sessions                                              |

Moderators sign in through the same `/login` page; the role only restricts what they see and can do.

## Notify followers

`/admin/notify-followers`, admins and moderators. A title (50 chars, sent as `Masjid Name: title` like timing-change alerts) and message (150 chars) go out as an Expo push to every device subscribed to the masjid, on the `masjid-updates` Android channel with `data.type = 'masjid_message'`, which the Alkhairia app opens as the masjid's page. Nothing reaches a display screen. The `notify-followers` Edge Function refuses a masjid that isn't `in_app` and a fourth send within a rolling 24 hours (429 with `retry_at`); a send that fails before reaching Expo is deleted so it doesn't use up the limit.

## Masjid profile

`/admin/settings/profile`, admin-only, table `masjid_profiles`.

Fields: `name`, `name_ur`, `name_ar`, `area`, `area_ur`, `area_ar`, `logo_url`, `latitude`, `longitude`, `timezone`, `contact_number`, `contact_email`, `website`. Localized fields render RTL in the matching script font and are optional; contact fields are optional but format-validated when present.

**Timezone is required** and is the masjid's wall clock for everything downstream. It is normally derived automatically: moving the map pin reverse-geocodes through Geoapify and accepts the result only if it looks like an IANA id. A `TimezonePicker` combobox over `Intl.supportedValuesOf('timeZone')` is the manual fallback — it handles renamed zones (Kolkata/Calcutta), prepends a non-canonical saved value, and degrades to free text where the runtime lists nothing. Postgres validates against `pg_timezone_names` in a trigger, and the column is `NOT NULL`.

**Location** is a Leaflet modal on Geoapify `osm-bright` tiles: click to place, "locate me" with distinct permission/unavailable/timeout messages, and a search box debounced 400 ms at a 3-character minimum. Default centre is Islamabad/Rawalpindi.

Logos upload to `masjid-logos/<masjid_id>/<timestamp>` so storage RLS can scope by folder. On a first-ever profile the logo uploads after the insert, then patches `logo_url`.

## Verification

`/admin/settings/verification`, admin-only. A new masjid lands here (`?setup=1`, with "Submit later") right after saving its first profile. Admins upload proof of existence and a photo (required) and a representation letter (optional) to the private `verification-documents` bucket, then submit for review. Files are locked while a review is pending. A banner across the console (`verification-banner.tsx`) asks admins to act until the masjid submits, and again after a rejection or suspension. Listing in the Alkhairia app can only be switched on once the masjid is verified. See [Database](./database.md) for the status rules.

## Platform area

`/platform`, for the SalatHub team only: users in `platform_admins`, added by hand with `INSERT INTO platform_admins (user_id) VALUES ('<auth user id>');`. Masjid users are sent back to the console. A platform admin with no masjid lands here after signing in; one who also runs a masjid gets a Platform link in the sidebar.

- **Review queue**: pending submissions, longest waiting first.
- **Masjids**: every masjid with its verification and app status. A masjid's page shows its documents, its admins' names and emails, its reports, and the approve, reject, suspend and restore actions.
- **Reports**: what app users reported, with the reported item, and a Resolve button.

Actions go through the `review-masjid` Edge Function, which checks `platform_admins`, makes the change as the caller so the decision records who made it, and emails the masjid's admins on approval or rejection. A failed email doesn't undo the decision; the reviewer is told.

## Display screens

Table `display_screens`, service `services/screens.ts`, managed at `/admin/screens` and `/admin/screens/:id`.

| Field                               | Values                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `name`                              | text                                                                                                                  |
| `code`                              | 7 chars over `0-9a-z`, generated with `crypto.getRandomValues` and rejection sampling — it is a credential, not an id |
| `orientation`                       | `landscape` / `portrait`                                                                                              |
| `theme`                             | `theme-1`…`theme-4`                                                                                                   |
| `custom_theme`                      | JSON or null — see [Display runtime](./display.md#themes)                                                             |
| `language`                          | `en` / `ur` / `ar`                                                                                                    |
| `slide_interval_seconds`            | 5–60, default 5; videos ignore it                                                                                     |
| `show_prayer_times`, `show_weather` | booleans                                                                                                              |
| `prayer_alert_triggers`             | subset of `['athan','iqamah']`, default empty — see [Display runtime](./display.md#prayer-alerts)                     |

**Assignment.** `screen_content` is a polymorphic join of `{ screen_id, content_id, content_type, display_order }` over the five content types. From a content row, the Screens action lists all screens with pre-checked boxes; saving diffs the selection, deleting removals and appending additions at `max(display_order) + 1`. Posts **and** ayat & hadith slides filter the list by orientation and banner how many screens were hidden. The assignment modal opens automatically right after creating an item. For announcements, events and posts it is titled **Where to show** and adds an "App followers" choice above the screens, which saves `show_in_app` on the item.

**Order lives on the join**, so the same item can sit at a different position on each screen. The detail page's table is drag-reorderable (writing contiguous `display_order`), and each row has an Unassign button that deletes its join row after a confirmation. Drafts assigned to the screen are dimmed and badged, since the display skips them. The page also hosts the theme picker, which renders only when `show_prayer_times` is on.

**Last seen.** Displays stamp `screen_heartbeats` through an RPC every 15 minutes, and the screens list renders the relative time, or "Never". There is **no threshold and no online/offline computation anywhere** — treat it as last-seen, not status.

Deleting a screen is a hard delete.
