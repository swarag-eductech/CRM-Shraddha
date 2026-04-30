-- Add media attachment support to ttp_messages
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- 1. Add media columns to messages table
ALTER TABLE ttp_messages
  ADD COLUMN IF NOT EXISTS media_url   TEXT,
  ADD COLUMN IF NOT EXISTS media_type  TEXT;  -- 'image' | 'video' | 'pdf' | 'document'

-- 2. Create storage bucket for CRM attachments (public read, auth upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'crm-attachments',
  'crm-attachments',
  true,
  20971520,  -- 20 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS: allow authenticated users to upload/read
CREATE POLICY IF NOT EXISTS "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'crm-attachments');

CREATE POLICY IF NOT EXISTS "Attachments are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'crm-attachments');
