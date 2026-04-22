import { createClient } from '@supabase/supabase-js';

// Credentials provided for the external product database
const PROVIDED_SUPABASE_URL = 'https://sujhbodzuteuixmxzzxf.supabase.co';
const PROVIDED_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1amhib2R6dXRldWl4bXh6enhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MDQxMTIsImV4cCI6MjA3OTM4MDExMn0.Wu3HqQxgIru8iA3MP3xDTMbyYAun1FtApBKPTmPyQ_M';

// Helper to safely get env variables
const getEnv = (viteKey: string, nextKey: string) => {
  const meta = import.meta as any;
  if (typeof meta !== 'undefined' && meta.env && meta.env[viteKey]) {
    return meta.env[viteKey];
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[nextKey]) {
      return process.env[nextKey];
    }
  } catch (e) {
    // Ignore ReferenceError for process
  }
  return null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL') || PROVIDED_SUPABASE_URL;
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY') || PROVIDED_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Name of the storage bucket in Supabase (if used for uploads)
export const STORAGE_BUCKET = 'uploads';