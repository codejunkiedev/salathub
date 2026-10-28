# Content

The five content types and the designer that produces one of them. Assignment to screens is covered in [Admin console](./admin-console.md#display-screens).

## The shared pattern

Every type has a list page with a create/edit modal, a soft delete that sets `archived: true` **and** removes all screen assignments, and per-screen ordering held on `screen_content` rather than on the item itself. Lists treat a null `archived` as not-archived, since legacy rows predate the default.

Content items therefore carry no `visible` or `display_order` of their own — those columns were dropped when ordering moved per-screen.

## Drafts and publishing

Every type has a nullable `published_at`; null is a draft. Creating offers **Save as draft** or **Publish**, editing keeps the current state, and each list row has a Publish / Unpublish action and a Status badge. A draft can be edited and assigned to screens, but `get_display_payload` leaves it out, so no screen shows it. Unpublishing keeps the screen assignments, so publishing again puts the item back where it was.

There is no per-screen show/hide: an item is on a screen when it is published and assigned there. `screen_content.visible` was dropped, and assignments that were hidden at the time were deleted rather than made visible.

## Announcements

A required `title` and `description`. The title is the slide heading; announcements created before titles existed have none and fall back to "اعلان". Simplest type; one announcement per slide.

## Events

Fields: `title`, `description`, `date_time`, optional `end_time`, `location`, and the Islamic-event roles `chief_guest`, `host` (optional), `qari`, `naat_khawn`, `karm_farma`.

Start and end are `timestamptz`, entered and rendered as the **masjid's** wall clock on every surface, so an 8pm Karachi event reads as 8pm to an admin in London and on a phone anywhere. `end_time > date_time` is enforced in both Zod and a database check.

An event is upcoming until `end_time`, or `date_time + 2 hours` where none is set — `DEFAULT_EVENT_DURATION_MINUTES` in TypeScript, mirrored by `event_ends_at()` in SQL, **change both together**. The database materializes this into `events.ends_at`, a stored generated column with a partial index, so the console's Upcoming / Past / All filter runs server-side. Finished events stop reaching screens: `get_display_payload` excludes them, and the display re-checks the cut-off on a minute tick so one also disappears between payload refetches.

## Posts

A `title` and one image, landscape or portrait, chosen first in an orientation picker and immutable thereafter. Landscape posts then offer a predesigned template from the `assets` bucket or an upload; portrait goes straight to upload, since the predesigned library is 16:9.

Images are validated on **aspect ratio only** — 16:9 or 9:16 within 5% — and any resolution is accepted. The pipeline centre-crops to the exact ratio, downscales to fit a 3840×2160 / 2160×3840 box (1920×1080 is the _recommended_, not maximum, size), never upscales, and re-encodes as JPEG stepping quality from 0.85 down to a floor of 0.6 to approach 5 MB.

Because quality bottoms out at that floor, **5 MB is a target, not a guarantee**, and the uploader enforces no size limit at all. An image already at the right ratio, within bounds and under 5 MB passes through untouched.

## YouTube videos

`title`, `youtube_url` (watch / embed / shorts / youtu.be forms), `loop_video`, with a live thumbnail preview as you type. Playback uses the IFrame Player API on a privacy-enhanced no-cookie embed, autoplay, no controls or branding. The player is created only for the active slide, so nothing plays in the background. Videos need a network connection and are dropped from the rotation when offline.

## Ayat & Hadith designer

A visual slide builder at `/admin/ayat-and-hadith/new` and `/:id/edit`; rendered images land in `ayat-hadith-slides`.

**Sourcing.** Orientation (landscape or portrait) is picked up front. Ayat pull from AlQuran.cloud — Arabic edition `quran-uthmani`, with optional Urdu and English translations from a fixed edition list. Hadith come from hadithapi.com across six collections, either by number (clamped to each book's maximum) or by keyword search with language and book filters, paged ten at a time. Fetches are debounced 500 ms and abortable, with a manual refresh; the result is persisted as `cached_text` so a slide can be reopened and edited. **References are generated client-side**, not fetched.

**Canvas.** A true-size canvas, CSS-scaled to fit, with layers for overlay, Arabic, Urdu, English and reference. Each text layer has its own font (from per-script sets), size, colour, line height and alignment; the reference layer carries separate Arabic and English fonts. Layers are freely dragged and resized with snapping and clamping, stored as percentage boxes so they survive an orientation change. Backgrounds come from a curated library, the masjid's own uploads (`user-backgrounds`, aspect-validated and downscaled through the same pipeline as posts), or a solid/gradient fill. The Design panel is an "Editing" selector rather than tabs, and its Reset restores positions only.

**Rendering.** On save the selection outlines are hidden, fonts are awaited, and the canvas is snapshotted to PNG at exactly canvas size, uploaded, and stored as `image_url` + `image_path`. **The display only ever shows that pre-rendered image** — `source` and `cached_text` exist to re-edit, not to re-render. Replacing a slide best-effort deletes the old object; deleting archives the row and removes the image.

Note that `ayatAndHadithSchema` in `lib/zod.ts` is imported nowhere and its shape is stale — the designer saves without Zod.
