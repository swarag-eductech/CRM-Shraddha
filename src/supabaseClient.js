import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fetvqggubxedatdryesz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZldHZxZ2d1YnhlZGF0ZHJ5ZXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4ODI3ODAsImV4cCI6MjA4ODQ1ODc4MH0.2Up5yzEfkCzf4hQ4CQ25OYAzMx7QPkfTZsFPHwvYsbA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
