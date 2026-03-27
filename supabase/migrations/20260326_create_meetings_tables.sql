-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create ttp_meetings and related tables
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure ttp_leads exists (create if missing)
CREATE TABLE IF NOT EXISTS ttp_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  source        TEXT,
  assigned_user_id UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Main meetings table
CREATE TABLE IF NOT EXISTS ttp_meetings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_datetime    TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER NOT NULL DEFAULT 30,
  meeting_link        TEXT,                          -- Google Meet URL (generated on creation)
  is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_30_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_15_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_5_sent     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Junction table: links leads to meetings (many-to-many)
CREATE TABLE IF NOT EXISTS ttp_meeting_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID NOT NULL REFERENCES ttp_meetings (id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES ttp_leads (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (meeting_id, lead_id)
);

-- 4. Per-lead notification log (used by send-reminders to avoid duplicate sends)
CREATE TABLE IF NOT EXISTS ttp_meeting_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID NOT NULL REFERENCES ttp_meetings (id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES ttp_leads (id) ON DELETE CASCADE,
  type        TEXT NOT NULL,    -- '30min' | '15min' | '5min'
  status      TEXT NOT NULL,    -- 'sent' | 'failed'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Prevent duplicate bookings for the same datetime slot
CREATE UNIQUE INDEX IF NOT EXISTS ttp_meetings_datetime_unique
  ON ttp_meetings (meeting_datetime)
  WHERE is_deleted = FALSE;

-- 6. Auto-update updated_at on ttp_meetings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON ttp_meetings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ttp_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Row Level Security
ALTER TABLE ttp_meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ttp_meeting_leads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ttp_meeting_notifications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default; add anon/user policies as needed.
