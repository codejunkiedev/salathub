-- ============================================
-- Acting on reports (PB-79)
-- ============================================
-- A platform admin can remove a reported feed item from the app, with a reason.
-- Only platform admins set or clear a removal; the masjid's own edits keep it.
-- Closing reports records what was done about them.

ALTER TABLE announcements
  ADD COLUMN removed_at TIMESTAMPTZ,
  ADD COLUMN removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN removal_reason TEXT CHECK (char_length(removal_reason) <= 500);
ALTER TABLE events
  ADD COLUMN removed_at TIMESTAMPTZ,
  ADD COLUMN removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN removal_reason TEXT CHECK (char_length(removal_reason) <= 500);
ALTER TABLE posts
  ADD COLUMN removed_at TIMESTAMPTZ,
  ADD COLUMN removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN removal_reason TEXT CHECK (char_length(removal_reason) <= 500);

-- Masjid users write these tables directly, so their writes keep the removal as it was.
CREATE OR REPLACE FUNCTION keep_feed_item_removal()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.removed_at := NULL;
      NEW.removed_by := NULL;
      NEW.removal_reason := NULL;
    ELSE
      NEW.removed_at := OLD.removed_at;
      NEW.removed_by := OLD.removed_by;
      NEW.removal_reason := OLD.removal_reason;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER keep_removal BEFORE INSERT OR UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION keep_feed_item_removal();
CREATE TRIGGER keep_removal BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION keep_feed_item_removal();
CREATE TRIGGER keep_removal BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION keep_feed_item_removal();

ALTER TABLE masjid_reports
  ADD COLUMN resolution TEXT CHECK (resolution IN ('dismissed', 'removed', 'suspended'));
UPDATE masjid_reports SET resolution = 'dismissed' WHERE resolved_at IS NOT NULL;
ALTER TABLE masjid_reports
  ADD CONSTRAINT masjid_reports_resolution_set CHECK ((resolved_at IS NULL) = (resolution IS NULL));

CREATE INDEX idx_masjid_reports_target ON masjid_reports (target_kind, target_id)
  WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION resolve_masjid_report(p_report_id UUID)
RETURNS masjid_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row masjid_reports;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE masjid_reports
  SET resolved_at = coalesce(resolved_at, now()),
      resolved_by = coalesce(resolved_by, auth.uid()),
      resolution = coalesce(resolution, 'dismissed')
  WHERE id = p_report_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

-- Closes every open report on one target. Returns how many were closed.
CREATE OR REPLACE FUNCTION close_masjid_reports(
  p_target_kind TEXT,
  p_target_id UUID,
  p_resolution TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE masjid_reports
  SET resolved_at = now(), resolved_by = auth.uid(), resolution = p_resolution
  WHERE target_kind = p_target_kind AND target_id = p_target_id AND resolved_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Removes a feed item from the app (closing its reports) or restores it.
-- Returns the item's masjid_id and title, for the email.
CREATE OR REPLACE FUNCTION set_feed_item_removal(
  p_kind TEXT,
  p_id UUID,
  p_removed BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason TEXT := nullif(btrim(p_reason), '');
  v_masjid_id UUID;
  v_title TEXT;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_removed AND v_reason IS NULL THEN
    RAISE EXCEPTION 'A removal needs a reason' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'announcement' THEN
    UPDATE announcements t
    SET removed_at = CASE WHEN p_removed THEN coalesce(t.removed_at, now()) END,
        removed_by = CASE WHEN p_removed THEN auth.uid() END,
        removal_reason = CASE WHEN p_removed THEN v_reason END
    WHERE t.id = p_id
    RETURNING t.masjid_id, coalesce(nullif(t.title, ''), left(t.description, 80))
    INTO v_masjid_id, v_title;
  ELSIF p_kind = 'event' THEN
    UPDATE events t
    SET removed_at = CASE WHEN p_removed THEN coalesce(t.removed_at, now()) END,
        removed_by = CASE WHEN p_removed THEN auth.uid() END,
        removal_reason = CASE WHEN p_removed THEN v_reason END
    WHERE t.id = p_id
    RETURNING t.masjid_id, t.title INTO v_masjid_id, v_title;
  ELSIF p_kind = 'post' THEN
    UPDATE posts t
    SET removed_at = CASE WHEN p_removed THEN coalesce(t.removed_at, now()) END,
        removed_by = CASE WHEN p_removed THEN auth.uid() END,
        removal_reason = CASE WHEN p_removed THEN v_reason END
    WHERE t.id = p_id
    RETURNING t.masjid_id, t.title INTO v_masjid_id, v_title;
  ELSE
    RAISE EXCEPTION 'Unknown kind' USING ERRCODE = '22023';
  END IF;

  IF v_masjid_id IS NULL THEN
    RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_removed THEN
    UPDATE masjid_reports
    SET resolved_at = now(), resolved_by = auth.uid(), resolution = 'removed'
    WHERE target_kind = p_kind AND target_id = p_id AND resolved_at IS NULL;
  END IF;

  RETURN jsonb_build_object('masjid_id', v_masjid_id, 'title', v_title);
END;
$$;

REVOKE ALL ON FUNCTION close_masjid_reports(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_feed_item_removal(TEXT, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION close_masjid_reports(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_feed_item_removal(TEXT, UUID, BOOLEAN, TEXT) TO authenticated;

-- A removed item can't be reported again.
CREATE OR REPLACE FUNCTION submit_masjid_report(
  p_device_id UUID,
  p_masjid_id UUID,
  p_target_kind TEXT,
  p_target_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL,
  p_daily_limit INTEGER DEFAULT 10
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_target_id UUID := CASE WHEN p_target_kind = 'masjid' THEN p_masjid_id ELSE p_target_id END;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM masjid_profiles WHERE id = p_masjid_id AND in_app) THEN
    RETURN 'not_found';
  END IF;

  IF (p_target_kind = 'announcement'
        AND NOT EXISTS (SELECT 1 FROM announcements
                        WHERE id = v_target_id AND masjid_id = p_masjid_id AND removed_at IS NULL))
     OR (p_target_kind = 'event'
        AND NOT EXISTS (SELECT 1 FROM events
                        WHERE id = v_target_id AND masjid_id = p_masjid_id AND removed_at IS NULL))
     OR (p_target_kind = 'post'
        AND NOT EXISTS (SELECT 1 FROM posts
                        WHERE id = v_target_id AND masjid_id = p_masjid_id AND removed_at IS NULL))
  THEN
    RETURN 'not_found';
  END IF;

  IF (
    SELECT count(*) FROM masjid_reports
    WHERE device_id = p_device_id AND created_at > now() - INTERVAL '24 hours'
  ) >= p_daily_limit THEN
    RETURN 'rate_limited';
  END IF;

  INSERT INTO masjid_reports (masjid_id, target_kind, target_id, reason, details, device_id)
  VALUES (p_masjid_id, p_target_kind, v_target_id, p_reason, nullif(btrim(p_details), ''), p_device_id)
  ON CONFLICT ON CONSTRAINT masjid_reports_one_per_device DO NOTHING;

  RETURN CASE WHEN FOUND THEN 'created' ELSE 'duplicate' END;
END;
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
      AND a.removed_at IS NULL
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
      AND e.removed_at IS NULL
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
      AND p.removed_at IS NULL
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
