-- ============================================
-- Announcements: a title
-- ============================================
-- New announcements require one (enforced by the form). The column stays
-- nullable so existing rows keep working; displays fall back to the generic
-- heading for them.

ALTER TABLE announcements ADD COLUMN title TEXT;
