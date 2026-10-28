-- ============================================
-- Content: show in app
-- ============================================
-- Whether a published item also goes to followers in the mobile app, or stays
-- on screens only. Only announcements, events and posts can reach the app;
-- YouTube videos and ayat/hadith slides are screen-only and carry no flag.

ALTER TABLE announcements ADD COLUMN show_in_app BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events        ADD COLUMN show_in_app BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE posts         ADD COLUMN show_in_app BOOLEAN NOT NULL DEFAULT true;
