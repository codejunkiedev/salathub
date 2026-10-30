-- ============================================
-- Reports from app users (PB-79)
-- ============================================
-- A phone reports a masjid or one of its feed items. Written through
-- `masjid-directory` only, keyed by the same install id as push_devices.

CREATE TABLE masjid_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('masjid', 'announcement', 'event', 'post')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('fake_masjid', 'wrong_information', 'inappropriate_content', 'other')),
  details TEXT CHECK (char_length(details) <= 1000),
  device_id UUID NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT masjid_reports_one_per_device UNIQUE (device_id, target_kind, target_id),
  CONSTRAINT masjid_reports_masjid_target CHECK (target_kind <> 'masjid' OR target_id = masjid_id)
);

CREATE INDEX idx_masjid_reports_open ON masjid_reports (created_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_masjid_reports_masjid ON masjid_reports (masjid_id);

ALTER TABLE masjid_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON masjid_reports FROM anon, authenticated;
GRANT SELECT ON masjid_reports TO authenticated;

CREATE POLICY "Platform admins can view reports"
  ON masjid_reports FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));

-- Returns 'created', 'duplicate', 'rate_limited' or 'not_found'.
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
        AND NOT EXISTS (SELECT 1 FROM announcements WHERE id = v_target_id AND masjid_id = p_masjid_id))
     OR (p_target_kind = 'event'
        AND NOT EXISTS (SELECT 1 FROM events WHERE id = v_target_id AND masjid_id = p_masjid_id))
     OR (p_target_kind = 'post'
        AND NOT EXISTS (SELECT 1 FROM posts WHERE id = v_target_id AND masjid_id = p_masjid_id))
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
      resolved_by = coalesce(resolved_by, auth.uid())
  WHERE id = p_report_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION submit_masjid_report(UUID, UUID, TEXT, UUID, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_masjid_report(UUID, UUID, TEXT, UUID, TEXT, TEXT, INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION resolve_masjid_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION resolve_masjid_report(UUID) TO authenticated;
