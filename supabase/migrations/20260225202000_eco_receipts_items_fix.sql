-- Phase A4: Fixing missing columns for earnings calculation
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Trigger PostgREST reload
NOTIFY pgrst, 'reload schema';
