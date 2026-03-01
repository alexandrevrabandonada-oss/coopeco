-- Migration: A41 — Content Flags
-- supabase/migrations/20260315000001_eco_content_flags.sql

CREATE TABLE IF NOT EXISTS public.eco_content_flags (
    media_id uuid REFERENCES public.edu_media_assets(id) ON DELETE CASCADE,
    flag text NOT NULL CHECK (flag IN ('food', 'liquids', 'mixed', 'sharp', 'volume', 'other')),
    material text,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (media_id, flag)
);

-- RLS
ALTER TABLE public.eco_content_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for content flags" ON public.eco_content_flags 
    FOR SELECT TO public USING (true);

CREATE POLICY "Cell operators manage flags" ON public.eco_content_flags 
    FOR ALL TO authenticated 
    USING (
        public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role])
        AND EXISTS (
            SELECT 1 FROM public.edu_media_assets m
            WHERE m.id = media_id
            AND (m.cell_id IS NULL OR m.cell_id IN (SELECT cell_id FROM public.eco_governance_mandates WHERE user_id = auth.uid() AND active = true))
        )
    )
    WITH CHECK (
        public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role])
        AND EXISTS (
            SELECT 1 FROM public.edu_media_assets m
            WHERE m.id = media_id
            AND (m.cell_id IS NULL OR m.cell_id IN (SELECT cell_id FROM public.eco_governance_mandates WHERE user_id = auth.uid() AND active = true))
        )
    );

-- Reload schema
NOTIFY pgrst, 'reload schema';
