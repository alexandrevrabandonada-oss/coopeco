-- Migration: A41 — Curadoria Local por Célula
-- supabase/migrations/20260315000000_eco_cell_curation.sql

-- A) Extend edu_media_assets with curation fields
ALTER TABLE public.edu_media_assets 
ADD COLUMN IF NOT EXISTS cell_id uuid REFERENCES public.eco_cells(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS published_at timestamptz,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

-- Ensure transcript_md exists (from A40/A39)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='edu_media_assets' AND column_name='transcript_md') THEN
        ALTER TABLE public.edu_media_assets ADD COLUMN transcript_md text;
    END IF;
END $$;

-- B) Update RLS for edu_media_assets
DROP POLICY IF EXISTS "Public read for media metadata" ON public.edu_media_assets;
CREATE POLICY "Public read for published media metadata" ON public.edu_media_assets 
    FOR SELECT TO public 
    USING (status = 'published' AND is_public = true);

-- Operators of the cell can manage their own assets
DROP POLICY IF EXISTS "Operators manage media assets" ON public.edu_media_assets;
CREATE POLICY "Cell operators manage their assets" ON public.edu_media_assets 
    FOR ALL TO authenticated 
    USING (
        public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role])
        AND (cell_id IS NULL OR cell_id IN (SELECT cell_id FROM public.eco_governance_mandates WHERE user_id = auth.uid() AND active = true))
    )
    WITH CHECK (
        public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role])
        AND (cell_id IS NULL OR cell_id IN (SELECT cell_id FROM public.eco_governance_mandates WHERE user_id = auth.uid() AND active = true))
    );

-- C) Workflow RPCs

-- Submit for review
CREATE OR REPLACE FUNCTION public.rpc_submit_media_for_review(p_media_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.edu_media_assets
    SET status = 'review'
    WHERE id = p_media_id AND status = 'draft'
    AND (cell_id IS NULL OR cell_id IN (SELECT cell_id FROM public.eco_governance_mandates WHERE user_id = auth.uid() AND active = true));
END;
$$;

-- Review decision (approve/reject)
CREATE OR REPLACE FUNCTION public.rpc_review_media(p_media_id uuid, p_decision text, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_decision = 'approve' THEN
        UPDATE public.edu_media_assets
        SET status = 'published',
            reviewed_by = auth.uid(),
            reviewed_at = now(),
            published_at = now()
        WHERE id = p_media_id AND status = 'review'
        AND public.has_role(ARRAY['moderator'::public.app_role])
        AND (cell_id IS NULL OR cell_id IN (SELECT cell_id FROM public.eco_governance_mandates WHERE user_id = auth.uid() AND active = true));
    ELSIF p_decision = 'reject' THEN
        UPDATE public.edu_media_assets
        SET status = 'draft',
            reviewed_by = auth.uid(),
            reviewed_at = now()
        WHERE id = p_media_id AND status = 'review'
        AND public.has_role(ARRAY['moderator'::public.app_role])
        AND (cell_id IS NULL OR cell_id IN (SELECT cell_id FROM public.eco_governance_mandates WHERE user_id = auth.uid() AND active = true));
    END IF;

    -- Audit trail (A31)
    INSERT INTO public.admin_audit_log (action, table_name, record_id, user_id, meta)
    VALUES ('media_review', 'edu_media_assets', p_media_id, auth.uid(), 
            jsonb_build_object('decision', p_decision, 'notes', p_notes));
END;
$$;

-- Archive
CREATE OR REPLACE FUNCTION public.rpc_archive_media(p_media_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.edu_media_assets
    SET status = 'archived'
    WHERE id = p_media_id
    AND (cell_id IS NULL OR cell_id IN (SELECT cell_id FROM public.eco_governance_mandates WHERE user_id = auth.uid() AND active = true));
END;
$$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
