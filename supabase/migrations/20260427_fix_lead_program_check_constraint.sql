-- Fix: Drop old lead_program check constraint and recreate with all 3 valid values
-- Run this in: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE ttp_leads DROP CONSTRAINT IF EXISTS ttp_leads_lead_program_check;

ALTER TABLE ttp_leads
  ADD CONSTRAINT ttp_leads_lead_program_check
  CHECK (lead_program IN (
    'student_abacus_class',
    'student_vedic_math',
    'ttp_teacher_training'
  ));
