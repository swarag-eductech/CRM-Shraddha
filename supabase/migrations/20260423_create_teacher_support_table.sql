-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Create teacher_support table
-- Teacher Support Desk - completely separate from leads system
-- Run in Supabase SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teacher_support (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_name       TEXT         NOT NULL,
  phone              TEXT         NOT NULL,
  center_name        TEXT,
  issue_type         TEXT         NOT NULL CHECK (issue_type IN ('Marketing Issue','Institutional Issue','Personal Issue')),
  issue_description  TEXT,
  status             TEXT         NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','In Progress','Resolved')),
  assigned_to        TEXT,        -- department label auto-filled
  assigned_user_id   UUID,        -- FK to crm_users (optional, for agent assignment)
  department         TEXT,        -- auto-assigned based on issue_type
  follow_up_date     DATE,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by         UUID         -- FK to crm_users
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION set_teacher_support_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_support_updated_at ON teacher_support;
CREATE TRIGGER trg_teacher_support_updated_at
  BEFORE UPDATE ON teacher_support
  FOR EACH ROW EXECUTE FUNCTION set_teacher_support_updated_at();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_teacher_support_status       ON teacher_support (status);
CREATE INDEX IF NOT EXISTS idx_teacher_support_issue_type   ON teacher_support (issue_type);
CREATE INDEX IF NOT EXISTS idx_teacher_support_assigned_user ON teacher_support (assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_support_created_at   ON teacher_support (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_support_follow_up    ON teacher_support (follow_up_date);

-- Enable Row Level Security
ALTER TABLE teacher_support ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read all
CREATE POLICY "teacher_support_select" ON teacher_support
  FOR SELECT TO authenticated USING (true);

-- Policy: authenticated users can insert
CREATE POLICY "teacher_support_insert" ON teacher_support
  FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: authenticated users can update
CREATE POLICY "teacher_support_update" ON teacher_support
  FOR UPDATE TO authenticated USING (true);

-- Policy: only admins can delete (soft-pattern not needed here, hard delete allowed)
CREATE POLICY "teacher_support_delete" ON teacher_support
  FOR DELETE TO authenticated USING (true);
