# Display runtime

What a screen actually does once it is signed in. How it _fetches_ is in [Architecture](./architecture.md#how-displays-read-data).

## Slide assembly

Route `/display` (`pages/app/display.tsx`), a full-screen Swiper with an 800 ms crossfade.

**Order:** prayer times (when `show_prayer_times`) → weather (when `show_weather` and a forecast exists) → follow QR (when `show_follow_qr` and the masjid is listed) → each visible `screen_content` item in `display_order`.

Archived items and finished events are excluded server-side by the RPC. The client additionally re-filters events on a 60-second tick, so an event disappears between payload refetches, and drops YouTube slides when offline.

**Rotation** is one `setInterval` on `slide_interval_seconds` that skips YouTube indices — a non-looping video advances the carousel itself when it ends, a looping one holds the slide. The interval is not reset by keyboard navigation or by a video ending, so an auto-advance can land immediately after a manual one.

**Orientation.** A screen is `landscape` or `portrait`. A guard compares the monitor's aspect ratio against the configured orientation and replaces the display with a message on mismatch, re-checking on resize.

The runtime also holds a wake lock (re-acquired on `visibilitychange`), sets i18n from the screen's language, and records heartbeats.

**Empty and failure states:** "No content assigned", a missing-prayer-settings message, an orientation-mismatch message, and an error screen offering Try Again and Sign Out. A null payload means the screen row is gone, and the display signs itself out.

## Prayer alerts

Active when at least one trigger is ticked. There is no separate enable switch, because an empty trigger list _is_ off.

A 1-second tick watches fajr, asr, maghrib, isha and the midday slot — Jumma variants on Fridays, Dhuhr otherwise, since alerting on a Jumma on a Tuesday would beep at an empty hall — deduping athan/iqamah collisions so a shared time beeps once. A 2-minute catch-up ceiling stops a woken TV replaying prayers it slept through, and each tick resolves in the masjid's zone so the cursor survives midnight.

The sound is synthesized with Web Audio — three 880 Hz sine tones, ~1.1 s total — so nothing is bundled or fetched and it works offline. Browsers keep audio suspended until a gesture, so the first `pointerdown`/`keydown`/`touchstart` primes the context.

Prayer timings are fetched whenever alerts are on, even with the prayer slide switched off.

## Themes

Four themes, chosen per screen, all fed identical props.

| Theme | Style                                                                                      |
| ----- | ------------------------------------------------------------------------------------------ |
| 1     | Decorative card art, seven-segment digits, gold header clock                               |
| 2     | Different art and fonts; 2×3 grid beside a tall side clock                                 |
| 3     | Flat emerald table — Prayer / Starts / Athan / Iqamah, zebra rows, highlighted next iqamah |
| 4     | **Custom** — its own layout engine, configured per screen                                  |

Themes 1–2 map prayers onto bundled card art (all three Jummas share one card) and cycle the active Jumma variants in place every 3 seconds, showing `iqamah` only. Themes 3–4 use no card art.

**Ishraq and Chasht render on Theme 4 only** — themes 1–3 show sunrise and sunset alone.

**Jumma behaves differently in three places**, which is worth knowing before touching it:

- Themes 1–2 cycle variants in one card, every day.
- Theme 3 _replaces_ Dhuhr with the Jumma rows, and only on Fridays.
- Theme 4 places Jumma rows _after_ Dhuhr, shows them every day, and drives them purely from the visibility switches rather than from whether an adjustment exists — the reasoning being that a congregant reads Friday's times before Friday.

The prayer alert follows Theme 3's rule.

## The custom theme

Theme 4 is no longer "Theme 3 with colours". It has three layouts — `table`, `cards` (one tile per prayer under a countdown ribbon) and `spotlight` (countdown as hero beside a compact list) — and only the table layout's base font sizes derive from Theme 3.

The editor (`/admin/screens/:id/customize-theme`) opens on the layout picker and shows a live, language-switchable preview with a Friday toggle. It changes appearance and element visibility only, never positioning.

- **Background** — image (curated library or own upload), solid, or gradient. Default is a `#064e3b`→`#022c22` gradient at 135°.
- **Overlay** — toggle, colour, opacity (default on, black, 0.3).
- **Fonts** — per script (English / Arabic / Urdu), overriding the fixed font classes.
- **Text size** — a global scale plus per-group multipliers that _compound_ on it, across seven groups: `header`, `names`, `times`, `countdown`, `date`, `masjidName`, `banner`. Slider 0.5–3.0 step 0.05. Sizes emit in container units so the theme scales identically full-screen and in the small preview.
- **Colours** — a global colour plus per-group overrides (`null` inherits).
- **Visibility** — fifteen toggles: `columnStarts`, `columnAthan`, `columnIqamah`, `jummaTimes`, `jumma1`, `jumma2`, `jumma3`, `masjidName`, `sunriseSunset`, `ishraq`, `chasht`, `nextIqamahCard`, `hijriDate`, `gregorianDate`, `clock`. At least one time column must stay on; `jumma2`/`jumma3` default off, the rest on. Sunrise and sunset share one flag; Ishraq and Chasht have their own.
- **Banner** — a scrolling announcement bar, off by default. Carries free text (500 characters), the masjid's contact details pulled live from the profile, or both; configurable position, direction, font, background colour and opacity, and speed.

Reset restores defaults but marks the form dirty rather than saving.

## Weather

OpenWeather's 5-day/3-hour metric forecast, shown when `show_weather` is on and a forecast exists.

Parsing takes the nearest slot as current conditions, then one entry per upcoming day (today skipped), preferring the sample closest to noon and tracking daily min/max, capped at seven days; wind converts to km/h. Days, "today" and the noon preference are all resolved on the masjid's clock — the slots themselves are UTC-aligned, so at most offsets none of them lands on noon exactly. The slide shows current icon, temperature, feels-like, description, humidity, wind, and a multi-day row, under a masjid-area heading.

Condition **names** are localized by stable condition id rather than OpenWeather's `lang` output, which is patchy — the request does still send `lang`, it is simply not trusted for names. Condition **backgrounds** key off the icon code _and_ the screen orientation, from two bundled sets with a `01d` fallback. Icons key off condition id and day/night.

The forecast refreshes every 30 minutes, hydrates from cache first, and keeps the last good data on failure. A **missing masjid location is a hard failure**: it replaces the whole slideshow with an error screen rather than omitting the slide.

## Internationalization

Screens render in English, Urdu or Arabic per `display_screens.language`. All three locale files carry identical key sets.

Direction is LTR for English and RTL for Urdu and Arabic, applied per component — `dir` is never set on `<html>` or `<body>`. Urdu and Arabic map to dedicated script fonts, except in Theme 4 where the admin picks fonts per script. The masjid's **name and area** both fall back to English when the localized field is blank.

**What is translated:** all four prayer themes — including their headers, countdowns and date lines — and the weather slide. Themes 1 and 2 bake each prayer _name_ into background art, so only those labels are untranslatable; everything else on them goes through `t()`. Forced-Latin digits are a weather-slide behaviour only; prayer times are raw API strings in LTR wrappers, and Hijri digits come straight from the API.

**What is not:** announcements, events, posts, ayat & hadith and YouTube slides, everything in `display/shared/`, the error screen, and — on a display, where it matters most — the hardcoded English orientation-mismatch and no-content messages. Admin surfaces are English-only, with one exception: the custom-theme editor renders a translated preview through `i18n.getFixedT(previewLanguage)`.

Locales live in `i18n/locales/`.
