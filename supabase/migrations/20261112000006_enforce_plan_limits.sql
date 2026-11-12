-- ============================================
-- Free and Pro plan limits (PB-87)
-- ============================================
-- plan_rules (PB-85) defines what each plan allows; this switches it on in
-- the database, so the limits hold whatever path a write takes. Refusals raise
-- SQLSTATE SH402 with a message the console shows as is.
--
-- A downgrade deletes nothing: screens over the limit are paused (the admin
-- picks which stay live, else the oldest), Pro-only content is left out of
-- screens and the app feed, and moderators lose access. An upgrade restores all.

-- ============================================
-- Plan helpers
-- ============================================

-- A masjid with no billing row is treated as Free.
CREATE OR REPLACE FUNCTION masjid_plan_rules(p_masjid_id UUID)
RETURNS plan_rules
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.* FROM plan_rules r
  WHERE r.plan = coalesce(
    (SELECT b.plan FROM masjid_billing b WHERE b.masjid_id = p_masjid_id),
    'free'
  );
$$;

CREATE OR REPLACE FUNCTION masjid_has_feature(p_masjid_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(p_feature = ANY ((masjid_plan_rules(p_masjid_id)).features), false);
$$;

CREATE OR REPLACE FUNCTION masjid_screen_limit(p_masjid_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.included_screens + CASE
      WHEN r.extra_screens_allowed THEN coalesce(
        (SELECT b.extra_screens FROM masjid_billing b WHERE b.masjid_id = p_masjid_id), 0)
      ELSE 0
    END
  FROM masjid_plan_rules(p_masjid_id) r;
$$;

REVOKE ALL ON FUNCTION masjid_plan_rules(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION masjid_has_feature(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION masjid_screen_limit(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION masjid_plan_rules(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION masjid_has_feature(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION masjid_screen_limit(UUID) TO service_role;

-- ============================================
-- Screens: the limit, and which screens are paused
-- ============================================
-- live_priority is set when an admin picks a paused screen to keep live; the
-- most recently picked come first, then the oldest.

ALTER TABLE display_screens ADD COLUMN live_priority TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION sync_masjid_screen_pauses(p_masjid_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit INTEGER := masjid_screen_limit(p_masjid_id);
BEGIN
  WITH ranked AS (
    SELECT s.id,
           row_number() OVER (ORDER BY s.live_priority DESC NULLS LAST, s.created_at, s.id) AS rn
    FROM display_screens s
    WHERE s.masjid_id = p_masjid_id
  )
  UPDATE display_screens s
  SET paused_at = CASE WHEN r.rn > v_limit THEN now() END
  FROM ranked r
  WHERE r.id = s.id
    AND (r.rn > v_limit) <> (s.paused_at IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION sync_masjid_screen_pauses(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION sync_screen_pauses_on_billing()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM sync_masjid_screen_pauses(NEW.masjid_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_screen_pauses_on_billing
  AFTER UPDATE OF plan, extra_screens ON masjid_billing
  FOR EACH ROW
  WHEN (OLD.plan IS DISTINCT FROM NEW.plan OR OLD.extra_screens IS DISTINCT FROM NEW.extra_screens)
  EXECUTE FUNCTION sync_screen_pauses_on_billing();

CREATE OR REPLACE FUNCTION sync_screen_pauses_on_screens()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM sync_masjid_screen_pauses(coalesce(NEW.masjid_id, OLD.masjid_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_screen_pauses_on_delete
  AFTER DELETE ON display_screens
  FOR EACH ROW EXECUTE FUNCTION sync_screen_pauses_on_screens();

CREATE TRIGGER trg_sync_screen_pauses_on_pick
  AFTER UPDATE OF live_priority ON display_screens
  FOR EACH ROW
  WHEN (OLD.live_priority IS DISTINCT FROM NEW.live_priority)
  EXECUTE FUNCTION sync_screen_pauses_on_screens();

-- New screens: refused over the limit. On a plan without them, a new screen
-- starts on the standard theme with weather off; changing a screen to a Pro
-- theme or turning weather on is refused.
CREATE OR REPLACE FUNCTION enforce_display_screen_plan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_limit := masjid_screen_limit(NEW.masjid_id);
    IF (SELECT count(*) FROM display_screens s WHERE s.masjid_id = NEW.masjid_id) >= v_limit THEN
      IF (masjid_plan_rules(NEW.masjid_id)).extra_screens_allowed THEN
        RAISE EXCEPTION 'Your plan has % screens. Add more screens from Manage billing on the Billing page.', v_limit
          USING ERRCODE = 'SH402';
      END IF;
      RAISE EXCEPTION 'The Free plan includes 1 screen. Upgrade to Pro on the Billing page to add more.'
        USING ERRCODE = 'SH402';
    END IF;
    IF NOT masjid_has_feature(NEW.masjid_id, 'all_themes') THEN
      NEW.theme := 'theme-1';
    END IF;
    IF NOT masjid_has_feature(NEW.masjid_id, 'weather') THEN
      NEW.show_weather := false;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.theme <> 'theme-1' AND NEW.theme IS DISTINCT FROM OLD.theme
     AND NOT masjid_has_feature(NEW.masjid_id, 'all_themes') THEN
    RAISE EXCEPTION 'Themes other than the standard one are part of Pro. Upgrade on the Billing page.'
      USING ERRCODE = 'SH402';
  END IF;
  IF NEW.show_weather AND NOT OLD.show_weather
     AND NOT masjid_has_feature(NEW.masjid_id, 'weather') THEN
    RAISE EXCEPTION 'Weather is part of Pro. Upgrade on the Billing page.'
      USING ERRCODE = 'SH402';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_display_screen_plan
  BEFORE INSERT OR UPDATE ON display_screens
  FOR EACH ROW EXECUTE FUNCTION enforce_display_screen_plan();

REVOKE ALL ON FUNCTION sync_screen_pauses_on_billing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_screen_pauses_on_screens() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enforce_display_screen_plan() FROM PUBLIC, anon, authenticated;

-- ============================================
-- Content
-- ============================================
-- Events, posts and YouTube videos can't be added on Free. Existing ones are
-- kept and come back on upgrade; screens and the app feed leave them out.

CREATE OR REPLACE FUNCTION enforce_pro_content()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_feature TEXT := CASE TG_TABLE_NAME
    WHEN 'events' THEN 'events'
    WHEN 'posts' THEN 'posts'
    WHEN 'youtube_videos' THEN 'youtube'
  END;
  v_label TEXT := CASE TG_TABLE_NAME
    WHEN 'events' THEN 'Events are'
    WHEN 'posts' THEN 'Posts are'
    WHEN 'youtube_videos' THEN 'YouTube videos are'
  END;
BEGIN
  IF NOT masjid_has_feature(NEW.masjid_id, v_feature) THEN
    RAISE EXCEPTION '% part of Pro. Upgrade on the Billing page to add them.', v_label
      USING ERRCODE = 'SH402';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_pro_content
  BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_pro_content();
CREATE TRIGGER trg_enforce_pro_content
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION enforce_pro_content();
CREATE TRIGGER trg_enforce_pro_content
  BEFORE INSERT ON youtube_videos
  FOR EACH ROW EXECUTE FUNCTION enforce_pro_content();

-- Published, non-archived announcements count; drafts don't.
CREATE OR REPLACE FUNCTION enforce_active_announcement_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_max INTEGER;
BEGIN
  IF NEW.published_at IS NULL OR NEW.archived THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL AND NOT OLD.archived THEN
    RETURN NEW;
  END IF;

  v_max := (masjid_plan_rules(NEW.masjid_id)).max_active_announcements;
  IF v_max IS NOT NULL AND (
    SELECT count(*) FROM announcements a
    WHERE a.masjid_id = NEW.masjid_id
      AND a.id <> NEW.id
      AND a.published_at IS NOT NULL
      AND NOT a.archived
  ) >= v_max THEN
    RAISE EXCEPTION 'The Free plan allows % published announcements. Unpublish or archive one, or upgrade to Pro on the Billing page.', v_max
      USING ERRCODE = 'SH402';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_active_announcement_limit
  BEFORE INSERT OR UPDATE OF published_at, archived ON announcements
  FOR EACH ROW EXECUTE FUNCTION enforce_active_announcement_limit();

REVOKE ALL ON FUNCTION enforce_pro_content() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enforce_active_announcement_limit() FROM PUBLIC, anon, authenticated;

-- ============================================
-- Moderators
-- ============================================
-- New moderators need Pro. On a plan without moderators, existing ones keep
-- their membership but every RLS check sees no masjid for them, so they can't
-- read or change anything until the masjid upgrades.

CREATE OR REPLACE FUNCTION enforce_moderator_plan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'moderator'
     AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'moderator')
     AND NOT masjid_has_feature(NEW.masjid_id, 'moderators') THEN
    RAISE EXCEPTION 'Moderators are part of Pro. Upgrade on the Billing page to add them.'
      USING ERRCODE = 'SH402';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_moderator_plan
  BEFORE INSERT OR UPDATE OF role ON masjid_members
  FOR EACH ROW EXECUTE FUNCTION enforce_moderator_plan();

REVOKE ALL ON FUNCTION enforce_moderator_plan() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION get_user_masjid_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.masjid_id FROM masjid_members m
  WHERE m.user_id = auth.uid()
    AND (m.role = 'admin' OR masjid_has_feature(m.masjid_id, 'moderators'))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM masjid_members m
  WHERE m.user_id = auth.uid()
    AND (m.role = 'admin' OR masjid_has_feature(m.masjid_id, 'moderators'))
  LIMIT 1;
$$;

-- The console's view of the signed-in user's membership. blocked says why a
-- member can't use the console, so a moderator isn't mistaken for a new signup.
CREATE OR REPLACE FUNCTION get_my_membership()
RETURNS TABLE (masjid_id UUID, role TEXT, blocked TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.masjid_id, m.role,
    CASE
      WHEN m.role = 'moderator' AND NOT masjid_has_feature(m.masjid_id, 'moderators')
        THEN 'moderators_need_pro'
    END
  FROM masjid_members m
  WHERE m.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_my_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_my_membership() TO authenticated;

-- ============================================
-- Follower notifications
-- ============================================
-- Free: prayer time changes and announcements. Pro also notifies about events
-- and posts, and can message followers (PB-81).

CREATE OR REPLACE FUNCTION content_notification_switches(p_masjid_id UUID)
RETURNS TABLE (announcements BOOLEAN, events BOOLEAN, posts BOOLEAN)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    coalesce(s.announcements, true),
    coalesce(s.events, true) AND masjid_has_feature(p_masjid_id, 'event_post_notifications'),
    coalesce(s.posts, false) AND masjid_has_feature(p_masjid_id, 'event_post_notifications')
  FROM (SELECT 1) AS one
  LEFT JOIN masjid_content_notification_settings s ON s.masjid_id = p_masjid_id;
$$;

CREATE OR REPLACE FUNCTION enforce_content_notification_plan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF masjid_has_feature(NEW.masjid_id, 'event_post_notifications') THEN
    RETURN NEW;
  END IF;
  -- A first save on Free starts them off; a choice saved on Pro is kept for
  -- after an upgrade, but switching one on now is refused.
  IF TG_OP = 'INSERT' THEN
    NEW.events := false;
    NEW.posts := false;
    RETURN NEW;
  END IF;
  IF (NEW.events AND NOT OLD.events) OR (NEW.posts AND NOT OLD.posts) THEN
    RAISE EXCEPTION 'Notifications for events and posts are part of Pro. Upgrade on the Billing page.'
      USING ERRCODE = 'SH402';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_content_notification_plan
  BEFORE INSERT OR UPDATE ON masjid_content_notification_settings
  FOR EACH ROW EXECUTE FUNCTION enforce_content_notification_plan();

REVOKE ALL ON FUNCTION enforce_content_notification_plan() FROM PUBLIC, anon, authenticated;

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
  IF NOT masjid_has_feature(p_masjid_id, 'follower_messages') THEN
    RAISE EXCEPTION 'Messages to followers are part of Pro. Upgrade on the Billing page.'
      USING ERRCODE = 'SH402';
  END IF;

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

-- ============================================
-- Screens show what the plan includes
-- ============================================

CREATE OR REPLACE FUNCTION get_display_payload(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_screen display_screens;
  v_rules plan_rules;
  v_screen_json JSONB;
  v_screen_content JSONB;
  v_content JSONB;
BEGIN
  SELECT * INTO v_screen FROM display_screens WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- What the plan leaves out is kept, just not shown: Pro-only content, Pro
  -- themes and weather, and announcements beyond the plan's active limit.
  v_rules := masjid_plan_rules(v_screen.masjid_id);
  v_screen_json := to_jsonb(v_screen);
  IF NOT ('all_themes' = ANY (v_rules.features)) AND v_screen.theme <> 'theme-1' THEN
    v_screen_json := jsonb_set(v_screen_json, '{theme}', '"theme-1"');
  END IF;
  IF NOT ('weather' = ANY (v_rules.features)) THEN
    v_screen_json := jsonb_set(v_screen_json, '{show_weather}', 'false');
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(sc) ORDER BY sc.display_order), '[]'::jsonb)
    INTO v_screen_content
    FROM screen_content sc
   WHERE sc.screen_id = v_screen.id;

  -- Drafts are left out here; the display skips playlist rows with no content.
  SELECT COALESCE(jsonb_object_agg(t.id, t.row), '{}'::jsonb)
    INTO v_content
    FROM (
      SELECT a.id::TEXT AS id, to_jsonb(a) AS row
        FROM announcements a
        JOIN screen_content sc
          ON sc.content_id = a.id AND sc.content_type = 'announcements'
       WHERE sc.screen_id = v_screen.id
         AND a.masjid_id = v_screen.masjid_id AND a.archived = false
         AND a.published_at IS NOT NULL
         AND (v_rules.max_active_announcements IS NULL OR a.id IN (
           SELECT recent.id FROM announcements recent
           WHERE recent.masjid_id = v_screen.masjid_id
             AND recent.archived = false AND recent.published_at IS NOT NULL
           ORDER BY recent.published_at DESC, recent.id
           LIMIT v_rules.max_active_announcements
         ))
      UNION ALL
      SELECT e.id::TEXT, to_jsonb(e)
        FROM events e
        JOIN screen_content sc
          ON sc.content_id = e.id AND sc.content_type = 'events'
       WHERE sc.screen_id = v_screen.id
         AND e.masjid_id = v_screen.masjid_id AND e.archived = false
         AND e.published_at IS NOT NULL
         AND e.ends_at >= now()
         AND 'events' = ANY (v_rules.features)
      UNION ALL
      SELECT p.id::TEXT, to_jsonb(p)
        FROM posts p
        JOIN screen_content sc
          ON sc.content_id = p.id AND sc.content_type = 'posts'
       WHERE sc.screen_id = v_screen.id
         AND p.masjid_id = v_screen.masjid_id AND p.archived = false
         AND p.published_at IS NOT NULL
         AND 'posts' = ANY (v_rules.features)
      UNION ALL
      SELECT y.id::TEXT, to_jsonb(y)
        FROM youtube_videos y
        JOIN screen_content sc
          ON sc.content_id = y.id AND sc.content_type = 'youtube_videos'
       WHERE sc.screen_id = v_screen.id
         AND y.masjid_id = v_screen.masjid_id AND y.archived = false
         AND y.published_at IS NOT NULL
         AND 'youtube' = ANY (v_rules.features)
      UNION ALL
      SELECT ah.id::TEXT, to_jsonb(ah)
        FROM ayat_and_hadith ah
        JOIN screen_content sc
          ON sc.content_id = ah.id AND sc.content_type = 'ayat_and_hadith'
       WHERE sc.screen_id = v_screen.id
         AND ah.masjid_id = v_screen.masjid_id AND ah.archived = false
         AND ah.published_at IS NOT NULL
    ) t;

  RETURN jsonb_build_object(
    'screen', v_screen_json,
    'masjid_profile', (
      SELECT to_jsonb(p) FROM masjid_profiles p WHERE p.id = v_screen.masjid_id
    ),
    'settings', (
      SELECT to_jsonb(x) FROM settings x
      WHERE x.masjid_id = v_screen.masjid_id ORDER BY x.created_at LIMIT 1
    ),
    'prayer_times', (
      SELECT to_jsonb(x) FROM prayer_times x
      WHERE x.masjid_id = v_screen.masjid_id ORDER BY x.created_at LIMIT 1
    ),
    'screen_content', v_screen_content,
    'content', v_content,
    'show_badge', coalesce((
      SELECT NOT ('hide_badge' = ANY (v_rules.features))
    ), true)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_display_payload(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_display_payload(TEXT) TO anon, authenticated;

-- ============================================
-- The app feed leaves out Pro-only content on Free
-- ============================================

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
      AND masjid_has_feature(e.masjid_id, 'events')
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
      AND masjid_has_feature(p.masjid_id, 'posts')
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
