-- ============================================
-- Free badge and paused screens (PB-88)
-- ============================================
-- A screen with paused_at set shows only "This screen isn't active". Only
-- server-side code sets it (PB-87 pauses screens over a plan's limit); a
-- console user's change to it is ignored, so the limit can't be lifted by hand.
-- The display payload says whether to show the "Powered by SalatHub" badge,
-- which every plan without the hide_badge feature shows.

ALTER TABLE display_screens ADD COLUMN paused_at TIMESTAMPTZ;

COMMENT ON COLUMN display_screens.paused_at IS
  'Set when the screen is over its masjid''s plan limit. Changed only by server-side code.';

CREATE OR REPLACE FUNCTION keep_display_screen_paused_at()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.paused_at := NULL;
    ELSE
      NEW.paused_at := OLD.paused_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_keep_display_screen_paused_at
  BEFORE INSERT OR UPDATE ON display_screens
  FOR EACH ROW EXECUTE FUNCTION keep_display_screen_paused_at();

REVOKE ALL ON FUNCTION keep_display_screen_paused_at() FROM PUBLIC, anon, authenticated;

-- A plan change can add or remove the badge, so wake the masjid's screens.
CREATE TRIGGER trg_bump_display_revision_on_plan
  AFTER UPDATE OF plan ON masjid_billing
  FOR EACH ROW
  WHEN (OLD.plan IS DISTINCT FROM NEW.plan)
  EXECUTE FUNCTION bump_display_revision();

CREATE OR REPLACE FUNCTION get_display_payload(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_screen display_screens;
  v_screen_content JSONB;
  v_content JSONB;
BEGIN
  SELECT * INTO v_screen FROM display_screens WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN NULL;
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
      UNION ALL
      SELECT e.id::TEXT, to_jsonb(e)
        FROM events e
        JOIN screen_content sc
          ON sc.content_id = e.id AND sc.content_type = 'events'
       WHERE sc.screen_id = v_screen.id
         AND e.masjid_id = v_screen.masjid_id AND e.archived = false
         AND e.published_at IS NOT NULL
         AND e.ends_at >= now()
      UNION ALL
      SELECT p.id::TEXT, to_jsonb(p)
        FROM posts p
        JOIN screen_content sc
          ON sc.content_id = p.id AND sc.content_type = 'posts'
       WHERE sc.screen_id = v_screen.id
         AND p.masjid_id = v_screen.masjid_id AND p.archived = false
         AND p.published_at IS NOT NULL
      UNION ALL
      SELECT y.id::TEXT, to_jsonb(y)
        FROM youtube_videos y
        JOIN screen_content sc
          ON sc.content_id = y.id AND sc.content_type = 'youtube_videos'
       WHERE sc.screen_id = v_screen.id
         AND y.masjid_id = v_screen.masjid_id AND y.archived = false
         AND y.published_at IS NOT NULL
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
    'screen', to_jsonb(v_screen),
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
      SELECT NOT ('hide_badge' = ANY (r.features))
      FROM masjid_billing b JOIN plan_rules r ON r.plan = b.plan
      WHERE b.masjid_id = v_screen.masjid_id
    ), false)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_display_payload(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_display_payload(TEXT) TO anon, authenticated;
