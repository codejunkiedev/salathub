-- ============================================
-- Content notifications
-- ============================================
-- An announcement, event or post notifies the masjid's followers once, when it
-- first shows in the app, if the masjid has that type switched on. Each item
-- waits two minutes in a queue first, so one taken out of the app straight
-- away never notifies anyone. The notify-content Edge Function drains it.

-- ============================================
-- Per-type switches
-- ============================================
-- Admins and moderators both write these. A masjid without a row gets the
-- defaults in content_notification_switches().

CREATE TABLE masjid_content_notification_settings (
  masjid_id UUID PRIMARY KEY REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  announcements BOOLEAN NOT NULL,
  events BOOLEAN NOT NULL,
  posts BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE masjid_content_notification_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON masjid_content_notification_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON masjid_content_notification_settings TO authenticated;

CREATE POLICY "Members can view own content notification settings"
  ON masjid_content_notification_settings FOR SELECT
  TO authenticated
  USING (masjid_id = get_user_masjid_id());

CREATE POLICY "Members can create own content notification settings"
  ON masjid_content_notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (masjid_id = get_user_masjid_id());

CREATE POLICY "Members can update own content notification settings"
  ON masjid_content_notification_settings FOR UPDATE
  TO authenticated
  USING (masjid_id = get_user_masjid_id())
  WITH CHECK (masjid_id = get_user_masjid_id());

CREATE OR REPLACE FUNCTION content_notification_switches(p_masjid_id UUID)
RETURNS TABLE (announcements BOOLEAN, events BOOLEAN, posts BOOLEAN)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    coalesce(s.announcements, true),
    coalesce(s.events, true),
    coalesce(s.posts, false)
  FROM (SELECT 1) AS one
  LEFT JOIN masjid_content_notification_settings s ON s.masjid_id = p_masjid_id;
$$;

REVOKE ALL ON FUNCTION content_notification_switches(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION content_notification_switches(UUID) TO service_role;

CREATE OR REPLACE FUNCTION content_notification_daily_limit()
RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$ SELECT 5 $$;

-- ============================================
-- When an item first shows in the app
-- ============================================

ALTER TABLE announcements ADD COLUMN app_shown_at TIMESTAMPTZ;
ALTER TABLE events        ADD COLUMN app_shown_at TIMESTAMPTZ;
ALTER TABLE posts         ADD COLUMN app_shown_at TIMESTAMPTZ;

-- What is in the app today has already been seen, so it never notifies.
UPDATE announcements SET app_shown_at = published_at
WHERE published_at IS NOT NULL AND show_in_app AND NOT coalesce(archived, false) AND removed_at IS NULL;
UPDATE events SET app_shown_at = published_at
WHERE published_at IS NOT NULL AND show_in_app AND NOT coalesce(archived, false) AND removed_at IS NULL;
UPDATE posts SET app_shown_at = published_at
WHERE published_at IS NOT NULL AND show_in_app AND NOT coalesce(archived, false) AND removed_at IS NULL;

CREATE TABLE content_notification_queue (
  content_type TEXT NOT NULL CHECK (content_type IN ('announcements', 'events', 'posts')),
  content_id UUID NOT NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type, content_id)
);

CREATE INDEX idx_content_notification_queue_queued_at ON content_notification_queue(queued_at);

ALTER TABLE content_notification_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON content_notification_queue FROM anon, authenticated;

-- Named to run after keep_removal, so a removal is already settled.
CREATE OR REPLACE FUNCTION mark_app_shown()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.app_shown_at := OLD.app_shown_at;
  ELSE
    NEW.app_shown_at := NULL;
  END IF;

  IF NEW.app_shown_at IS NULL
    AND NEW.published_at IS NOT NULL
    AND NEW.show_in_app
    AND NOT coalesce(NEW.archived, false)
    AND NEW.removed_at IS NULL
  THEN
    NEW.app_shown_at := now();
    INSERT INTO content_notification_queue (content_type, content_id)
    VALUES (TG_TABLE_NAME, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_app_shown BEFORE INSERT OR UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION mark_app_shown();
CREATE TRIGGER mark_app_shown BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION mark_app_shown();
CREATE TRIGGER mark_app_shown BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION mark_app_shown();

CREATE OR REPLACE FUNCTION claim_content_notifications(
  p_delay_seconds INTEGER DEFAULT 120,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (content_type TEXT, content_id UUID, queued_at TIMESTAMPTZ)
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  DELETE FROM content_notification_queue c
  WHERE (c.content_type, c.content_id) IN (
    SELECT q.content_type, q.content_id
    FROM content_notification_queue q
    WHERE q.queued_at <= now() - make_interval(secs => greatest(p_delay_seconds, 0))
    ORDER BY q.queued_at
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING c.content_type, c.content_id, c.queued_at;
$$;

REVOKE ALL ON FUNCTION claim_content_notifications(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_content_notifications(INTEGER, INTEGER) TO service_role;

-- ============================================
-- Sent notifications, and the daily limit
-- ============================================
-- Counted apart from masjid_notifications, so content and a masjid's own
-- messages each have their own limit.

CREATE TABLE masjid_content_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masjid_id UUID NOT NULL REFERENCES masjid_profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('announcements', 'events', 'posts')),
  content_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  devices_reached INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id)
);

CREATE INDEX idx_masjid_content_notifications_masjid_created
  ON masjid_content_notifications(masjid_id, created_at DESC);

ALTER TABLE masjid_content_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON masjid_content_notifications FROM anon, authenticated;

-- Returns the new row's id, or why nothing was sent: not_in_app, switched_off
-- or daily_limit. Locks the masjid row so two sends cannot both pass the count.
CREATE OR REPLACE FUNCTION claim_content_notification(
  p_masjid_id UUID,
  p_content_type TEXT,
  p_content_id UUID,
  p_title TEXT,
  p_body TEXT
)
RETURNS TABLE (id UUID, skipped TEXT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_in_app BOOLEAN;
  v_on BOOLEAN;
BEGIN
  SELECT m.in_app INTO v_in_app FROM masjid_profiles m WHERE m.id = p_masjid_id FOR UPDATE;
  IF NOT coalesce(v_in_app, false) THEN
    RETURN QUERY SELECT NULL::UUID, 'not_in_app'::TEXT;
    RETURN;
  END IF;

  SELECT CASE p_content_type
    WHEN 'announcements' THEN s.announcements
    WHEN 'events' THEN s.events
    WHEN 'posts' THEN s.posts
  END INTO v_on
  FROM content_notification_switches(p_masjid_id) s;
  IF NOT coalesce(v_on, false) THEN
    RETURN QUERY SELECT NULL::UUID, 'switched_off'::TEXT;
    RETURN;
  END IF;

  IF (
    SELECT count(*) FROM masjid_content_notifications n
    WHERE n.masjid_id = p_masjid_id AND n.created_at > now() - interval '24 hours'
  ) >= content_notification_daily_limit() THEN
    RETURN QUERY SELECT NULL::UUID, 'daily_limit'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO masjid_content_notifications (masjid_id, content_type, content_id, title, body)
  VALUES (p_masjid_id, p_content_type, p_content_id, p_title, p_body)
  ON CONFLICT (content_type, content_id) DO NOTHING
  RETURNING masjid_content_notifications.id, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION claim_content_notification(UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_content_notification(UUID, TEXT, UUID, TEXT, TEXT) TO service_role;

-- ============================================
-- What the console needs to say whether publishing notifies
-- ============================================

CREATE OR REPLACE FUNCTION get_content_notification_status()
RETURNS TABLE (
  announcements BOOLEAN,
  events BOOLEAN,
  posts BOOLEAN,
  in_app BOOLEAN,
  daily_limit INTEGER,
  sent_today INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    s.announcements,
    s.events,
    s.posts,
    m.in_app,
    content_notification_daily_limit(),
    (
      SELECT count(*)::INTEGER FROM masjid_content_notifications n
      WHERE n.masjid_id = m.id AND n.created_at > now() - interval '24 hours'
    )
  FROM masjid_profiles m
  CROSS JOIN LATERAL content_notification_switches(m.id) s
  WHERE m.id = get_user_masjid_id();
$$;

REVOKE ALL ON FUNCTION get_content_notification_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_content_notification_status() TO authenticated;

-- ============================================
-- Run notify-content every minute
-- ============================================
-- Reads the Vault secrets `project_url` and `content_notifications_secret`, the
-- latter matching the Edge Function's CONTENT_NOTIFICATIONS_SECRET.

SELECT cron.schedule(
  'notify-content',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
      || '/functions/v1/notify-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'content_notifications_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
