-- Migration: A42 — Compressão de Mídia
-- supabase/migrations/20260316000000_eco_media_compression.sql

-- A) Extend edu_media_assets with compression fields
ALTER TABLE public.edu_media_assets
ADD COLUMN IF NOT EXISTS original_path text,
ADD COLUMN IF NOT EXISTS compressed_path text,
ADD COLUMN IF NOT EXISTS mime_type text,
ADD COLUMN IF NOT EXISTS compression_status text DEFAULT 'none' CHECK (compression_status IN ('none', 'queued', 'processing', 'done', 'failed')),
ADD COLUMN IF NOT EXISTS compression_error text,
ADD COLUMN IF NOT EXISTS width int,
ADD COLUMN IF NOT EXISTS height int,
ADD COLUMN IF NOT EXISTS bitrate_kbps int,
ADD COLUMN IF NOT EXISTS checksum text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- B) eco_media_jobs: Tracking background compression tasks
CREATE TABLE IF NOT EXISTS public.eco_media_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    media_id uuid REFERENCES public.edu_media_assets(id) ON DELETE CASCADE,
    job_kind text NOT NULL CHECK (job_kind IN ('compress_video', 'compress_audio', 'strip_metadata')),
    status text DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
    attempts int DEFAULT 0,
    last_error text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS: eco_media_jobs
ALTER TABLE public.eco_media_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage media jobs" ON public.eco_media_jobs 
    FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]))
    WITH CHECK (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- Index for processing queue
CREATE INDEX IF NOT EXISTS idx_media_jobs_status_created ON public.eco_media_jobs (status, created_at);

-- C) Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_media_assets_updated_at
    BEFORE UPDATE ON public.edu_media_assets
    FOR EACH ROW EXECUTE FUNCTION public.handle_media_updated_at();

CREATE TRIGGER tr_media_jobs_updated_at
    BEFORE UPDATE ON public.eco_media_jobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_media_updated_at();

-- Reload schema
NOTIFY pgrst, 'reload schema';
