-- ============================================
-- App reads gate on in_app (PB-79)
-- ============================================
-- The directory, the feed and push registration read `in_app` instead of
-- `listed`. Bodies are otherwise unchanged; CREATE OR REPLACE keeps the grants.

CREATE OR REPLACE FUNCTION search_masjids_nearby(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 25,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  name_ur TEXT,
  name_ar TEXT,
  area TEXT,
  area_ur TEXT,
  area_ar TEXT,
  logo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT,
  contact_number TEXT,
  contact_email TEXT,
  website TEXT,
  updated_at TIMESTAMPTZ,
  prayer_updated_at TIMESTAMPTZ,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_radius DOUBLE PRECISION := least(greatest(coalesce(p_radius_km, 25), 0.5), 200);
  v_limit INTEGER := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_lat_delta DOUBLE PRECISION;
  v_lng_delta DOUBLE PRECISION;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN;
  END IF;

  v_lat_delta := v_radius / 111.045;
  -- Longitude degrees shrink towards the poles; the floor keeps the box finite
  -- rather than dividing by a cosine that reaches zero.
  v_lng_delta := v_radius / (111.045 * greatest(cos(radians(p_lat)), 0.01));

  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.name_ur,
    m.name_ar,
    m.area,
    m.area_ur,
    m.area_ar,
    m.logo_url,
    m.latitude,
    m.longitude,
    m.timezone,
    m.contact_number,
    m.contact_email,
    m.website,
    m.updated_at,
    -- When the masjid last touched its prayer configuration, so the app can say
    -- how current the times are rather than leaving a follower to assume.
    GREATEST(
      (SELECT max(s.updated_at) FROM settings s WHERE s.masjid_id = m.id),
      (SELECT max(t.updated_at) FROM prayer_times t WHERE t.masjid_id = m.id)
    ) AS prayer_updated_at,
    masjid_distance_km(p_lat, p_lng, m.latitude, m.longitude) AS distance_km
  FROM masjid_profiles m
  WHERE m.in_app
    AND m.latitude BETWEEN p_lat - v_lat_delta AND p_lat + v_lat_delta
    AND m.longitude BETWEEN p_lng - v_lng_delta AND p_lng + v_lng_delta
    AND masjid_distance_km(p_lat, p_lng, m.latitude, m.longitude) <= v_radius
  ORDER BY masjid_distance_km(p_lat, p_lng, m.latitude, m.longitude)
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION search_masjids_by_name(
  p_query TEXT,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  name_ur TEXT,
  name_ar TEXT,
  area TEXT,
  area_ur TEXT,
  area_ar TEXT,
  logo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT,
  contact_number TEXT,
  contact_email TEXT,
  website TEXT,
  updated_at TIMESTAMPTZ,
  prayer_updated_at TIMESTAMPTZ,
  distance_km DOUBLE PRECISION
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_limit INTEGER := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_term TEXT := btrim(coalesce(p_query, ''));
  v_pattern TEXT;
BEGIN
  -- One character matches most of the directory; make the caller mean it.
  IF length(v_term) < 2 THEN
    RETURN;
  END IF;

  -- The wildcards belong to us, not to the search term.
  v_pattern := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.name_ur,
    m.name_ar,
    m.area,
    m.area_ur,
    m.area_ar,
    m.logo_url,
    m.latitude,
    m.longitude,
    m.timezone,
    m.contact_number,
    m.contact_email,
    m.website,
    m.updated_at,
    -- When the masjid last touched its prayer configuration, so the app can say
    -- how current the times are rather than leaving a follower to assume.
    GREATEST(
      (SELECT max(s.updated_at) FROM settings s WHERE s.masjid_id = m.id),
      (SELECT max(t.updated_at) FROM prayer_times t WHERE t.masjid_id = m.id)
    ) AS prayer_updated_at,
    masjid_distance_km(p_lat, p_lng, m.latitude, m.longitude) AS distance_km
  FROM masjid_profiles m
  WHERE m.in_app
    AND (
      m.name ILIKE v_pattern
      OR m.name_ur ILIKE v_pattern
      OR m.name_ar ILIKE v_pattern
      OR m.area ILIKE v_pattern
      OR m.area_ur ILIKE v_pattern
      OR m.area_ar ILIKE v_pattern
    )
  ORDER BY
    -- Distance when the phone offered a location, name otherwise. NULLS LAST so
    -- a masjid outside the box never outranks one inside it.
    masjid_distance_km(p_lat, p_lng, m.latitude, m.longitude) ASC NULLS LAST,
    m.name ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_masjids_public(p_ids UUID[])
RETURNS TABLE (
  id UUID,
  name TEXT,
  name_ur TEXT,
  name_ar TEXT,
  area TEXT,
  area_ur TEXT,
  area_ar TEXT,
  logo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT,
  contact_number TEXT,
  contact_email TEXT,
  website TEXT,
  updated_at TIMESTAMPTZ,
  prayer_updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    m.id,
    m.name,
    m.name_ur,
    m.name_ar,
    m.area,
    m.area_ur,
    m.area_ar,
    m.logo_url,
    m.latitude,
    m.longitude,
    m.timezone,
    m.contact_number,
    m.contact_email,
    m.website,
    m.updated_at,
    GREATEST(
      (SELECT max(s.updated_at) FROM settings s WHERE s.masjid_id = m.id),
      (SELECT max(t.updated_at) FROM prayer_times t WHERE t.masjid_id = m.id)
    ) AS prayer_updated_at
  FROM masjid_profiles m
  WHERE m.in_app
    AND m.id = ANY(coalesce(p_ids, ARRAY[]::UUID[]))
  ORDER BY m.name
  LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION get_masjid_feed(
  p_ids UUID[],
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0
)
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
  JOIN masjid_profiles m ON m.id = i.masjid_id AND m.in_app
  ORDER BY
    i.upcoming DESC,
    CASE WHEN i.upcoming THEN i.starts_at END ASC,
    i.sort_at DESC,
    i.id
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION register_push_device(
  p_device_id UUID,
  p_token TEXT,
  p_platform TEXT,
  p_masjid_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  DELETE FROM push_devices WHERE expo_push_token = p_token AND id <> p_device_id;

  INSERT INTO push_devices (id, expo_push_token, platform)
  VALUES (p_device_id, p_token, p_platform)
  ON CONFLICT (id) DO UPDATE
    SET expo_push_token = EXCLUDED.expo_push_token,
        platform = EXCLUDED.platform,
        updated_at = now();

  DELETE FROM push_subscriptions
  WHERE device_id = p_device_id
    AND masjid_id <> ALL(coalesce(p_masjid_ids, ARRAY[]::UUID[]));

  INSERT INTO push_subscriptions (device_id, masjid_id)
  SELECT p_device_id, m.id
  FROM masjid_profiles m
  WHERE m.in_app
    AND m.id = ANY(coalesce(p_masjid_ids, ARRAY[]::UUID[]))
  ON CONFLICT DO NOTHING;
END;
$$;
