-- ============================================
-- Masjid notifications: short messages pushed to a masjid's followers
-- ============================================
-- Rows are written by the notify-followers Edge Function only. Members read
-- their own masjid's history.

CREATE TABLE masjid_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 50),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 150),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_name TEXT NOT NULL,
  devices_reached INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_masjid_notifications_masjid_created
  ON masjid_notifications(masjid_id, created_at DESC);

ALTER TABLE masjid_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON masjid_notifications FROM anon, authenticated;
GRANT SELECT ON masjid_notifications TO authenticated;

CREATE POLICY "Members can view own masjid notifications"
  ON masjid_notifications FOR SELECT
  TO authenticated
  USING (masjid_id = get_user_masjid_id());

-- ============================================
-- Follower count for the caller's masjid
-- ============================================

CREATE OR REPLACE FUNCTION count_masjid_followers()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::INTEGER
  FROM push_subscriptions
  WHERE masjid_id = get_user_masjid_id();
$$;

REVOKE ALL ON FUNCTION count_masjid_followers() FROM PUBLIC;
REVOKE ALL ON FUNCTION count_masjid_followers() FROM anon;
GRANT EXECUTE ON FUNCTION count_masjid_followers() TO authenticated;

-- ============================================
-- Claim a send under the per-masjid limit
-- ============================================
-- Locks the masjid row so two sends at once cannot both pass the count. When
-- the limit is reached no row is written and retry_at says when the oldest
-- send in the window expires.

CREATE OR REPLACE FUNCTION claim_masjid_notification(
  p_masjid_id UUID,
  p_sent_by UUID,
  p_sent_by_name TEXT,
  p_title TEXT,
  p_body TEXT,
  p_limit INTEGER,
  p_window INTERVAL
)
RETURNS TABLE (id UUID, retry_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_recent TIMESTAMPTZ[];
BEGIN
  PERFORM 1 FROM masjid_profiles m WHERE m.id = p_masjid_id FOR UPDATE;

  SELECT array_agg(n.created_at ORDER BY n.created_at DESC)
  INTO v_recent
  FROM masjid_notifications n
  WHERE n.masjid_id = p_masjid_id
    AND n.created_at > now() - p_window;

  IF coalesce(array_length(v_recent, 1), 0) >= p_limit THEN
    RETURN QUERY SELECT NULL::UUID, v_recent[p_limit] + p_window;
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO masjid_notifications (masjid_id, title, body, sent_by, sent_by_name)
  VALUES (p_masjid_id, p_title, p_body, p_sent_by, p_sent_by_name)
  RETURNING masjid_notifications.id, NULL::TIMESTAMPTZ;
END;
$$;

REVOKE ALL ON FUNCTION claim_masjid_notification(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_masjid_notification(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTERVAL) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_masjid_notification(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTERVAL) TO service_role;
