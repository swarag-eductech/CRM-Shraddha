-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add day-based and 1-hour reminder tracking columns to ttp_meetings
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ttp_meetings
  ADD COLUMN IF NOT EXISTS reminder_3day_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_2day_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_1day_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminder_1hour_sent  BOOLEAN NOT NULL DEFAULT FALSE;

-- Expand the type CHECK constraint to include new reminder types
ALTER TABLE ttp_meeting_notifications
  DROP CONSTRAINT IF EXISTS ttp_meeting_notifications_type_check;

ALTER TABLE ttp_meeting_notifications
  ADD CONSTRAINT ttp_meeting_notifications_type_check
  CHECK (type = ANY (ARRAY['3day','2day','1day','1hour','30min','15min','5min']));
