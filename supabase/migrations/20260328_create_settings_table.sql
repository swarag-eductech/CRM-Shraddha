-- Migration: Add 24h reminder support
ALTER TABLE ttp_meetings ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Create ttp_settings table
CREATE TABLE IF NOT EXISTS ttp_settings (
  id                          TEXT PRIMARY KEY DEFAULT 'default',
  admin_email                 TEXT DEFAULT 'info@shraddhainstitute.in',
  admin_phone                 TEXT DEFAULT '9900000000',
  institute_name              TEXT DEFAULT 'Shraddha Institute',
  whatsapp_api_key            TEXT,
  auto_reminder_hours         INTEGER DEFAULT 24,
  default_message_template    TEXT DEFAULT 'Hello {name}! Thank you for your interest in Shraddha Institute.',
  new_lead_alert              BOOLEAN DEFAULT TRUE,
  meeting_reminders           BOOLEAN DEFAULT TRUE,
  whatsapp_replies            BOOLEAN DEFAULT FALSE,
  weekly_report               BOOLEAN DEFAULT TRUE,
  dark_mode                   BOOLEAN DEFAULT FALSE,
  compact_sidebar             BOOLEAN DEFAULT FALSE,
  auto_reminders_enabled      BOOLEAN DEFAULT TRUE,
  two_factor_auth             BOOLEAN DEFAULT FALSE,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings if they don't exist
INSERT INTO ttp_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE ttp_settings ENABLE ROW LEVEL SECURITY;
-- For now, allow all access since it's an admin setting
CREATE POLICY "Allow all access to settings" ON ttp_settings FOR ALL USING (TRUE);
