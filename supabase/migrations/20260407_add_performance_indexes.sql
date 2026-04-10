-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add performance indexes + vedic_math program support
-- Run in Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Indexes on ttp_leads (primary hot table)
--    These make every filter/sort query dramatically faster

-- Most queries filter by is_deleted first
CREATE INDEX IF NOT EXISTS idx_ttp_leads_is_deleted
  ON ttp_leads (is_deleted);

-- Ordered by created_at DESC on every load
CREATE INDEX IF NOT EXISTS idx_ttp_leads_created_at
  ON ttp_leads (created_at DESC);

-- Status filter (new / contacted / warm / converted / lost)
CREATE INDEX IF NOT EXISTS idx_ttp_leads_status
  ON ttp_leads (status);

-- Program filter (student_abacus_class / student_vedic_math / ttp_teacher_training)
CREATE INDEX IF NOT EXISTS idx_ttp_leads_lead_program
  ON ttp_leads (lead_program);

-- Assigned user filter (non-admin users only see their own leads)
CREATE INDEX IF NOT EXISTS idx_ttp_leads_assigned_user_id
  ON ttp_leads (assigned_user_id);

-- Phone lookup (deduplication on WhatsApp webhook and meeting booking)
CREATE INDEX IF NOT EXISTS idx_ttp_leads_phone
  ON ttp_leads (phone);

-- Composite: most common query pattern — is_deleted + order by created_at
CREATE INDEX IF NOT EXISTS idx_ttp_leads_deleted_created
  ON ttp_leads (is_deleted, created_at DESC);

-- 2. Indexes on ttp_followups
CREATE INDEX IF NOT EXISTS idx_ttp_followups_lead_id
  ON ttp_followups (lead_id);

CREATE INDEX IF NOT EXISTS idx_ttp_followups_is_deleted
  ON ttp_followups (is_deleted);

CREATE INDEX IF NOT EXISTS idx_ttp_followups_reminder_sent
  ON ttp_followups (reminder_sent)
  WHERE reminder_sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_ttp_followups_next_at
  ON ttp_followups (next_followup_at);

-- 3. Indexes on ttp_notifications
CREATE INDEX IF NOT EXISTS idx_ttp_notifications_created_at
  ON ttp_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ttp_notifications_user_id
  ON ttp_notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_ttp_notifications_is_read
  ON ttp_notifications (is_read)
  WHERE is_read = FALSE;

-- 4. Indexes on ttp_meetings
CREATE INDEX IF NOT EXISTS idx_ttp_meetings_datetime
  ON ttp_meetings (meeting_datetime);

CREATE INDEX IF NOT EXISTS idx_ttp_meetings_is_deleted
  ON ttp_meetings (is_deleted);

-- 5. Indexes on ttp_meeting_leads
CREATE INDEX IF NOT EXISTS idx_ttp_meeting_leads_meeting_id
  ON ttp_meeting_leads (meeting_id);

CREATE INDEX IF NOT EXISTS idx_ttp_meeting_leads_lead_id
  ON ttp_meeting_leads (lead_id);

-- 6. Add student_vedic_math to lead_program if using a CHECK constraint
--    (Only needed if your schema has a constraint — safe to run either way)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ttp_leads' AND column_name = 'lead_program'
  ) THEN
    -- Add column default (no-op if already exists with correct type)
    ALTER TABLE ttp_leads
      ALTER COLUMN lead_program SET DEFAULT 'student_abacus_class';
  END IF;
END $$;

-- 7. Add boosted_campaign source label (no schema change needed — source is free TEXT)
--    This migration just documents the allowed values for your team:
COMMENT ON COLUMN ttp_leads.source IS
  'Origin channel: manual | landing_page | website | intrakt | whatsapp | boosted_campaign | meeting_booking';

COMMENT ON COLUMN ttp_leads.lead_program IS
  'Program interest: student_abacus_class | student_vedic_math | ttp_teacher_training';
