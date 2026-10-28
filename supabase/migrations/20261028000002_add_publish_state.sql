-- ============================================
-- Content: draft / published, and no per-screen visibility
-- ============================================
-- Every content type gets `published_at`. NULL is a draft: it can be edited
-- and assigned to screens, but no screen (and later no app feed) shows it.
-- Unpublishing sets it back to NULL and keeps the screen assignments, so
-- publishing again restores the item where it was.
--
-- screen_content.visible goes away. Whether an item shows is now decided by
-- its publish state; whether it shows on a given screen is decided by being
-- assigned there or not.

ALTER TABLE announcements   ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE events          ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE posts           ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE youtube_videos  ADD COLUMN published_at TIMESTAMPTZ;
ALTER TABLE ayat_and_hadith ADD COLUMN published_at TIMESTAMPTZ;

-- Everything that exists today is live, so it stays published.
UPDATE announcements   SET published_at = created_at;
UPDATE events          SET published_at = created_at;
UPDATE posts           SET published_at = created_at;
UPDATE youtube_videos  SET published_at = created_at;
UPDATE ayat_and_hadith SET published_at = created_at;

-- A hidden assignment is the nearest thing to no assignment. Dropping the rows
-- keeps those items off their screens instead of making them reappear.
DELETE FROM screen_content WHERE NOT visible;
ALTER TABLE screen_content DROP COLUMN visible;

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
    'content', v_content
  );
END;
$$;

REVOKE ALL ON FUNCTION get_display_payload(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_display_payload(TEXT) TO anon, authenticated;
