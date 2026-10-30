import type { PrayerAdjustments, SingleAdjustment, Theme } from './common';
import type { HijriCalculationMethod } from '@/constants';

export enum SupabaseTables {
  MasjidProfiles = 'masjid_profiles',
  Announcements = 'announcements',
  Events = 'events',
  Posts = 'posts',
  YouTubeVideos = 'youtube_videos',
  PrayerTimes = 'prayer_times',
  Settings = 'settings',
  DisplayScreens = 'display_screens',
  ScreenContent = 'screen_content',
  ScreenHeartbeats = 'screen_heartbeats',
  DisplayRevisions = 'display_revisions',
  MasjidMembers = 'masjid_members',
  AyatAndHadith = 'ayat_and_hadith',
  MasjidNotifications = 'masjid_notifications',
  MasjidVerifications = 'masjid_verifications',
  VerificationDocuments = 'verification_documents',
  MasjidReports = 'masjid_reports',
}

export enum SupabaseBuckets {
  MasjidLogos = 'masjid-logos',
  MasjidPosts = 'masjid-posts',
  Assets = 'assets',
  AyatHadithSlides = 'ayat-hadith-slides',
  UserBackgrounds = 'user-backgrounds',
  VerificationDocuments = 'verification-documents',
}

export enum SupabaseFolders {
  PredesignedPosts = 'predesigned-posts',
  AyatHadithBackgrounds = 'ayat-hadith-backgrounds',
}

export type MemberRole = 'admin' | 'moderator';

export interface MasjidMember {
  id: string;
  masjid_id: string;
  user_id: string;
  role: MemberRole;
  name: string;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export type VerificationStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';

export interface MasjidVerification {
  masjid_id: string;
  status: VerificationStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  grace_until: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
}

/** existence: registration, charity letter or utility bill. representation: letter naming the applicant. */
export type VerificationDocumentKind = 'existence' | 'representation' | 'photo';

export interface VerificationDocument {
  id: string;
  masjid_id: string;
  kind: VerificationDocumentKind;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

/** A masjid as the platform admin area lists it. */
export type PlatformMasjid = Pick<
  MasjidProfile,
  'id' | 'name' | 'area' | 'logo_url' | 'listed' | 'in_app'
> & { created_at: string; verification: MasjidVerification | null };

export type ReportTargetKind = 'masjid' | 'announcement' | 'event' | 'post';
export type ReportReason = 'fake_masjid' | 'wrong_information' | 'inappropriate_content' | 'other';

export interface MasjidReport {
  id: string;
  masjid_id: string;
  target_kind: ReportTargetKind;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  resolved_at: string | null;
  created_at: string;
  masjid: { name: string } | null;
}

export interface ReportTarget {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
}

export interface MasjidNotification {
  id: string;
  masjid_id: string;
  title: string;
  body: string;
  sent_by: string | null;
  sent_by_name: string;
  devices_reached: number | null;
  created_at: string;
}

interface Base {
  id: string;
  user_id: string;
  masjid_id: string;
  created_at: string;
  updated_at: string;
}

/** Content that moderators draft and publish. Null `published_at` is a draft. */
export interface Publishable {
  published_at: string | null;
}

export interface MasjidProfile extends Base {
  logo_url: string;
  name: string;
  name_ur: string;
  name_ar: string;
  area: string;
  area_ur: string;
  area_ar: string;
  latitude: number | null;
  longitude: number | null;
  /** IANA zone id, e.g. `Asia/Karachi`. NOT NULL since 20260910000003. */
  timezone: string;
  contact_number: string;
  contact_email: string;
  website: string;
  /** Opt-in to the public mobile directory. Requires coordinates; see 20260918000001. */
  listed: boolean;
  /** Listed, verified or in grace, and not suspended. Set by the database only. */
  in_app: boolean;
}

export type ScreenOrientation = 'landscape' | 'portrait';
export type ScreenContentType =
  'announcements' | 'events' | 'posts' | 'youtube_videos' | 'ayat_and_hadith';
/** Content types that can also reach followers in the app, via `show_in_app`. */
export type AppContentType = Extract<ScreenContentType, 'announcements' | 'events' | 'posts'>;
export type PostOrientation = 'landscape' | 'portrait';

export type AyatHadithType = 'ayat' | 'hadith';

export interface AyatSource {
  surah: number;
  ayah: number;
}

export interface HadithSource {
  book: string;
  hadith_number: string;
}

export interface AyatHadithCachedText {
  arabic: string;
  urdu?: { edition: string; text: string };
  english?: { edition: string; text: string };
  reference?: { arabic: string; english: string };
}

export interface BackgroundImage {
  name: string;
  url: string;
}

export type AyatHadithAlign = 'left' | 'center' | 'right';

export interface AyatHadithTextStyle {
  font_id: string;
  size: number;
  color: string;
  line_height: number;
  align: AyatHadithAlign;
}

export interface AyatHadithReferenceStyle extends AyatHadithTextStyle {
  arabic_font_id: string;
}

export type AyatHadithBackground =
  | { type: 'image'; url: string }
  | { type: 'color'; color: string }
  | { type: 'gradient'; from: string; to: string; angle: number };

/** Position + size of a layer, as percentages (0–100) of the canvas. */
export interface AyatHadithBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AyatHadithLayerKey = 'overlay' | 'arabic' | 'urdu' | 'english' | 'reference';

export interface AyatHadithPositions {
  overlay: AyatHadithBox;
  arabic: AyatHadithBox;
  urdu: AyatHadithBox;
  english: AyatHadithBox;
  reference: AyatHadithBox;
}

export interface AyatHadithStyle {
  background: AyatHadithBackground;
  overlay_color: string;
  overlay_opacity: number;
  show_overlay: boolean;
  arabic: AyatHadithTextStyle;
  urdu: AyatHadithTextStyle;
  english: AyatHadithTextStyle;
  reference: AyatHadithReferenceStyle;
  positions: AyatHadithPositions;
}

export interface AyatAndHadith extends Base, Publishable {
  type: AyatHadithType;
  orientation: ScreenOrientation;
  source: AyatSource | HadithSource;
  cached_text: AyatHadithCachedText;
  style: AyatHadithStyle;
  image_url: string;
  image_path: string;
  archived: boolean;
}

export type DisplayLanguage = 'en' | 'ur' | 'ar';

/** The moments in a prayer's schedule a screen can sound an alert at. */
export type PrayerAlertTrigger = 'athan' | 'iqamah';

/**
 * Text groups for the custom prayer-timings theme. Each group is an independent
 * unit for the per-group size multiplier and the semantic color slot, mapped to
 * Theme 3's typographic roles.
 */
export type CustomThemeTextGroup =
  'header' | 'names' | 'times' | 'countdown' | 'date' | 'masjidName' | 'banner';

/**
 * Arrangement of the custom theme's elements. Every layout renders the same
 * data and honours every other setting — the choice is composition only:
 *
 * - `table`     Theme 3's arrangement: top bar, prayer table, countdown card.
 * - `cards`     One card per prayer in a grid, under a countdown ribbon.
 * - `spotlight` The countdown as the hero, beside a compact prayer list.
 */
export type CustomThemeLayout = 'table' | 'cards' | 'spotlight';

/** Which edge of the screen the announcement banner is pinned to. */
export type CustomThemeBannerPosition = 'top' | 'bottom';

/** Scroll speed presets for the announcement banner. */
export type CustomThemeBannerSpeed = 'slow' | 'normal' | 'fast';

/**
 * What the banner scrolls:
 *
 * - `text`    The announcement typed into the banner's own box.
 * - `contact` The contact number, email and website from the masjid profile.
 * - `both`    Both, one after the other, repeating for as long as the slide is
 *             up: announcement, contact details, announcement, contact details.
 */
export type CustomThemeBannerContent = 'text' | 'contact' | 'both';

/**
 * Scrolling announcement ticker for the custom theme. `text` is plain text the
 * admin types in whatever language they want, so it does not follow the
 * screen's Display Language: `direction` is chosen explicitly, and `font` is a
 * font id resolved across every script rather than per-language (see
 * `resolveFontById`). Text size and color are not stored here — the banner is a
 * {@link CustomThemeTextGroup}, so it uses the shared size/color slots.
 *
 * Contact details are never stored here either: `content` only records the
 * choice, and the values are read live from the masjid profile so editing them
 * in Settings updates every screen at once.
 */
export interface CustomThemeBanner {
  enabled: boolean;
  content: CustomThemeBannerContent;
  text: string;
  position: CustomThemeBannerPosition;
  direction: 'ltr' | 'rtl';
  font: string;
  background: { color: string; opacity: number };
  speed: CustomThemeBannerSpeed;
}

/**
 * Per-element show/hide flags for the custom theme. The prayer-name column is
 * always shown; at least one of the three time columns must stay visible
 * (enforced in the controls). Hidden elements reflow within the chosen layout.
 *
 * The Jumma rows sit after Dhuhr rather than replacing it, and show every day of
 * the week — a congregant reads Friday's times before Friday. Which of the three
 * appear is these switches and nothing else: a Jumma with no adjustment saved in
 * Prayer Timings still renders, carrying the unadjusted Dhuhr time. The Next
 * Iqamah card is the one place the weekday matters, counting down to Jumma on a
 * Friday and to Dhuhr on every other day.
 */
export interface CustomThemeVisibility {
  columnStarts: boolean;
  columnAthan: boolean;
  columnIqamah: boolean;
  jummaTimes: boolean;
  jumma1: boolean;
  jumma2: boolean;
  jumma3: boolean;
  masjidName: boolean;
  sunriseSunset: boolean;
  ishraq: boolean;
  chasht: boolean;
  nextIqamahCard: boolean;
  hijriDate: boolean;
  gregorianDate: boolean;
  clock: boolean;
}

/**
 * Text colors for the custom theme: one `global` color plus optional per-group
 * overrides. A null override means that group inherits `global`.
 */
export interface CustomThemeColors {
  global: string;
  overrides: Record<CustomThemeTextGroup, string | null>;
}

/**
 * Per-screen config for the custom prayer-timings theme (theme-4). `layout`
 * picks the arrangement; every other setting is shared across all of them and
 * affects appearance and element visibility only — never positioning within a
 * layout. `size.scale` is a global multiplier on the layout's base sizes,
 * `size.groups` are per-group fine-tune multipliers on top of it.
 */
export interface CustomThemeConfig {
  layout: CustomThemeLayout;
  background: AyatHadithBackground;
  overlay: { enabled: boolean; color: string; opacity: number };
  fonts: { english: string; arabic: string; urdu: string };
  size: { scale: number; groups: Record<CustomThemeTextGroup, number> };
  colors: CustomThemeColors;
  visibility: CustomThemeVisibility;
  banner: CustomThemeBanner;
}

export interface DisplayScreen extends Base {
  name: string;
  code: string;
  orientation: ScreenOrientation;
  show_prayer_times: boolean;
  show_weather: boolean;
  show_follow_qr: boolean;
  theme: Theme;
  custom_theme: CustomThemeConfig | null;
  language: DisplayLanguage;
  slide_interval_seconds: number;
  prayer_alert_triggers: PrayerAlertTrigger[];
}

export interface ScreenContent {
  id: string;
  screen_id: string;
  content_id: string;
  content_type: ScreenContentType;
  display_order: number;
  created_at: string;
}

export interface Announcement extends Base, Publishable {
  title: string | null;
  description: string;
  archived: boolean;
  show_in_app: boolean;
}

export interface Event extends Base, Publishable {
  title: string;
  description: string;
  date_time: string;
  /** Null means the default duration applies. */
  end_time: string | null;
  /** Generated by the database; read-only. */
  ends_at: string;
  location: string;
  chief_guest: string;
  host: string;
  qari: string;
  naat_khawn: string;
  karm_farma: string;
  archived: boolean;
  show_in_app: boolean;
}

export interface Post extends Base, Publishable {
  title: string;
  image_url: string;
  archived: boolean;
  orientation: PostOrientation;
  show_in_app: boolean;
}

export interface YouTubeVideo extends Base, Publishable {
  title: string;
  youtube_url: string;
  loop_video: boolean;
  archived: boolean;
}

// settings and prayer_times are one row per masjid. user_id only records who
// wrote the row, and is null once that account has been deleted.
export interface PrayerTimes extends Omit<Base, 'user_id'> {
  user_id: string | null;
  prayer_adjustments?: PrayerAdjustments;
}

export type SolarTimeName = 'sunrise' | 'ishraq' | 'chasht' | 'sunset';

export type SolarAdjustments = Record<SolarTimeName, SingleAdjustment>;

export interface Settings extends Omit<Base, 'user_id'> {
  user_id: string | null;
  hijri_calculation_method?: HijriCalculationMethod;
  hijri_offset?: number;
  calculation_method?: number;
  juristic_school?: number;
  sunrise_adjustment?: SingleAdjustment;
  sunset_adjustment?: SingleAdjustment;
  ishraq_adjustment?: SingleAdjustment;
  chasht_adjustment?: SingleAdjustment;
}
