-- PostgREST Schema Reload
-- This migration triggers an instant cache refresh in the Supabase PostgREST layer
NOTIFY pgrst, 'reload schema';
