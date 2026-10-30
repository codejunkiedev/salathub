-- ============================================
-- Platform admin area (PB-79)
-- ============================================
-- Platform admins read reported feed items to judge them. grace_warned_at
-- keeps verification-jobs from sending the grace warning email twice.

ALTER TABLE masjid_verifications ADD COLUMN grace_warned_at TIMESTAMPTZ;

CREATE POLICY "Platform admins can view announcements"
  ON announcements FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can view events"
  ON events FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can view posts"
  ON posts FOR SELECT TO authenticated
  USING ((SELECT is_platform_admin()));
