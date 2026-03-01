-- Migration: A39 — Educação Multimídia Leve
-- supabase/migrations/20260313000000_eco_multimedia_education.sql

-- A) edu_media_assets: Metadata for educational media
CREATE TABLE IF NOT EXISTS public.edu_media_assets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('video', 'audio', 'image')),
    slug text UNIQUE NOT NULL,
    title text NOT NULL,
    description text CHECK (char_length(description) <= 300),
    locale text DEFAULT 'vr' NOT NULL,
    material text,
    flag text,
    storage_path text NOT NULL, -- Path relative to the bucket
    duration_seconds int,
    size_bytes bigint,
    created_at timestamptz DEFAULT now()
);

-- RLS: edu_media_assets
ALTER TABLE public.edu_media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for media metadata" ON public.edu_media_assets 
    FOR SELECT TO public USING (true);

CREATE POLICY "Operators manage media assets" ON public.edu_media_assets 
    FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role]))
    WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- B) edu_tip_media: Link media to tips
CREATE TABLE IF NOT EXISTS public.edu_tip_media (
    tip_id uuid REFERENCES public.edu_tips(id) ON DELETE CASCADE,
    media_id uuid REFERENCES public.edu_media_assets(id) ON DELETE CASCADE,
    priority int DEFAULT 1,
    PRIMARY KEY (tip_id, media_id)
);

-- RLS: edu_tip_media
ALTER TABLE public.edu_tip_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for tip links" ON public.edu_tip_media 
    FOR SELECT TO public USING (true);

CREATE POLICY "Operators manage tip links" ON public.edu_tip_media 
    FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role]))
    WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- C) neighborhood_learning_media_focus: Weekly media highlights
CREATE TABLE IF NOT EXISTS public.neighborhood_learning_media_focus (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    media_ids uuid[] DEFAULT ARRAY[]::uuid[],
    created_at timestamptz DEFAULT now(),
    UNIQUE (neighborhood_id, week_start)
);

-- RLS: neighborhood_learning_media_focus
ALTER TABLE public.neighborhood_learning_media_focus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for media focus" ON public.neighborhood_learning_media_focus 
    FOR SELECT TO public USING (true);

CREATE POLICY "Operators manage media focus" ON public.neighborhood_learning_media_focus 
    FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role]))
    WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- Reload schema
NOTIFY pgrst, 'reload schema';
