-- ============================================
-- Masjid feed for the mobile app
-- ============================================
-- Published, show-in-app announcements, events and posts from listed masjids,
-- served through the `masjid-directory` Edge Function like the rest of the
-- directory. Upcoming events come first, soonest first; everything else follows
-- newest first, with a past event dated by when it took place.

CREATE OR REPLACE FUNCTION get_masjid_feed(p_ids UUID[], p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  kind TEXT,
  masjid_id UUID,
  title TEXT,
  body TEXT,
  image_url TEXT,
  orientation TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  location TEXT,
  chief_guest TEXT,
  host TEXT,
  qari TEXT,
  naat_khawn TEXT,
  karm_farma TEXT,
  published_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH items AS (
    SELECT
      a.id, 'announcement'::TEXT AS kind, a.masjid_id, a.title, a.description AS body,
      NULL::TEXT AS image_url, NULL::TEXT AS orientation,
      NULL::TIMESTAMPTZ AS starts_at, NULL::TIMESTAMPTZ AS ends_at,
      NULL::TEXT AS location, NULL::TEXT AS chief_guest, NULL::TEXT AS host,
      NULL::TEXT AS qari, NULL::TEXT AS naat_khawn, NULL::TEXT AS karm_farma,
      a.published_at, false AS upcoming, a.published_at AS sort_at
    FROM announcements a
    WHERE a.masjid_id = ANY(p_ids)
      AND a.published_at IS NOT NULL AND a.show_in_app AND NOT a.archived
    UNION ALL
    SELECT
      e.id, 'event', e.masjid_id, e.title, e.description,
      NULL, NULL,
      e.date_time, e.ends_at,
      e.location, e.chief_guest, e.host,
      e.qari, e.naat_khawn, e.karm_farma,
      e.published_at, e.ends_at >= now(), e.date_time
    FROM events e
    WHERE e.masjid_id = ANY(p_ids)
      AND e.published_at IS NOT NULL AND e.show_in_app AND NOT e.archived
    UNION ALL
    SELECT
      p.id, 'post', p.masjid_id, p.title, NULL,
      NULLIF(p.image_url, ''), p.orientation,
      NULL, NULL,
      NULL, NULL, NULL,
      NULL, NULL, NULL,
      p.published_at, false, p.published_at
    FROM posts p
    WHERE p.masjid_id = ANY(p_ids)
      AND p.published_at IS NOT NULL AND p.show_in_app AND NOT p.archived
  )
  SELECT
    i.id, i.kind, i.masjid_id, i.title, i.body, i.image_url, i.orientation,
    i.starts_at, i.ends_at, i.location, i.chief_guest, i.host,
    i.qari, i.naat_khawn, i.karm_farma, i.published_at
  FROM items i
  JOIN masjid_profiles m ON m.id = i.masjid_id AND m.listed
  ORDER BY
    i.upcoming DESC,
    CASE WHEN i.upcoming THEN i.starts_at END ASC,
    i.sort_at DESC
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

REVOKE ALL ON FUNCTION get_masjid_feed(UUID[], INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_masjid_feed(UUID[], INTEGER) TO service_role;
