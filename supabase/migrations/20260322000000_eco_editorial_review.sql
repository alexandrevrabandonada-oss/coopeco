-- Migration: A48 — Revisão Editorial por Célula
-- supabase/migrations/20260322000000_eco_editorial_review.sql

-- 1. eco_editorial_queue: Unified queue for all content review
CREATE TABLE IF NOT EXISTS public.eco_editorial_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    source_kind text NOT NULL CHECK (source_kind IN ('template', 'campaign_item', 'bulletin', 'edu_media', 'partner_notes_public', 'runbook_card')),
    source_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected', 'published')),
    requested_by uuid REFERENCES auth.users(id),
    requested_at timestamptz,
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    review_notes text,
    lint_summary jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(cell_id, source_kind, source_id)
);

-- 2. eco_editorial_versions: History of changes
CREATE TABLE IF NOT EXISTS public.eco_editorial_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_id uuid REFERENCES public.eco_editorial_queue(id) ON DELETE CASCADE,
    version int NOT NULL,
    previous_text text,
    new_text text NOT NULL,
    change_reason text,
    changed_by uuid REFERENCES auth.users(id),
    changed_at timestamptz DEFAULT now(),
    UNIQUE(queue_id, version)
);

-- 3. Configuration: Add editorial_mode to cells (extending existing charter/settings)
-- Assuming eco_cells doesn't have a settings/config JSON, we add a simple field for now
-- or use a dedicated settings table if available. For ECO, we'll try to add it to eco_cells or a related table.
ALTER TABLE public.eco_cells ADD COLUMN IF NOT EXISTS editorial_mode text DEFAULT 'lint_only' CHECK (editorial_mode IN ('off', 'lint_only', 'review_required'));

-- RLS & Policies
ALTER TABLE public.eco_editorial_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_editorial_versions ENABLE ROW LEVEL SECURITY;

-- Read: Operators/Moderators of the same cell + Author
CREATE POLICY "Operators read cell editorial queue" ON public.eco_editorial_queue
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m 
            WHERE m.user_id = auth.uid() AND m.cell_id = eco_editorial_queue.cell_id AND m.status = 'active'
        ) 
        OR requested_by = auth.uid()
    );

CREATE POLICY "Operators write cell editorial queue" ON public.eco_editorial_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m 
            WHERE m.user_id = auth.uid() AND m.cell_id = eco_editorial_queue.cell_id AND m.status = 'active'
        ) 
        OR requested_by = auth.uid()
    );

-- Read: Same logic for versions
CREATE POLICY "Operators read versions" ON public.eco_editorial_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.eco_editorial_queue q
            WHERE q.id = eco_editorial_versions.queue_id
            AND (
                EXISTS (SELECT 1 FROM public.eco_mandates m WHERE m.user_id = auth.uid() AND m.cell_id = q.cell_id AND m.status = 'active')
                OR q.requested_by = auth.uid()
            )
        )
    );

-- RPCs
-- A) Request review
CREATE OR REPLACE FUNCTION public.rpc_request_editorial_review(
    p_cell_id uuid,
    p_source_kind text,
    p_source_id uuid,
    p_lint_summary jsonb DEFAULT '{}'
) RETURNS uuid AS $$
DECLARE
    v_queue_id uuid;
BEGIN
    INSERT INTO public.eco_editorial_queue (cell_id, source_kind, source_id, status, requested_by, requested_at, lint_summary)
    VALUES (p_cell_id, p_source_kind, p_source_id, 'review', auth.uid(), now(), p_lint_summary)
    ON CONFLICT (cell_id, source_kind, source_id) 
    DO UPDATE SET 
        status = 'review',
        requested_by = auth.uid(),
        requested_at = now(),
        lint_summary = p_lint_summary,
        updated_at = now()
    RETURNING id INTO v_queue_id;
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B) Submit Decision
CREATE OR REPLACE FUNCTION public.rpc_submit_editorial_decision(
    p_queue_id uuid,
    p_decision text,
    p_notes text DEFAULT NULL
) RETURNS void AS $$
BEGIN
    UPDATE public.eco_editorial_queue
    SET 
        status = p_decision, -- 'approved' or 'rejected'
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = p_notes,
        updated_at = now()
    WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C) Save Version
CREATE OR REPLACE FUNCTION public.rpc_save_editorial_version(
    p_queue_id uuid,
    p_new_text text,
    p_reason text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_version int;
    v_old_text text;
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM public.eco_editorial_versions WHERE queue_id = p_queue_id;
    SELECT new_text INTO v_old_text FROM public.eco_editorial_versions WHERE queue_id = p_queue_id ORDER BY version DESC LIMIT 1;
    
    INSERT INTO public.eco_editorial_versions (queue_id, version, previous_text, new_text, change_reason, changed_by)
    VALUES (p_queue_id, v_version, v_old_text, p_new_text, p_reason, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D) Publish from Editorial
CREATE OR REPLACE FUNCTION public.rpc_publish_from_editorial(
    p_queue_id uuid
) RETURNS void AS $$
DECLARE
    v_item record;
    v_latest_text text;
BEGIN
    SELECT * INTO v_item FROM public.eco_editorial_queue WHERE id = p_queue_id;
    SELECT new_text INTO v_latest_text FROM public.eco_editorial_versions WHERE queue_id = p_queue_id ORDER BY version DESC LIMIT 1;

    IF v_item.status != 'approved' THEN
        RAISE EXCEPTION 'Apenas itens aprovados podem ser publicados.';
    END IF;

    -- Finalize based on source kind
    CASE v_item.source_kind
        WHEN 'template' THEN
            UPDATE public.eco_comms_templates 
            SET body_md = v_latest_text, is_active = true, updated_at = now()
            WHERE id = v_item.source_id;
        
        WHEN 'campaign_item' THEN
            UPDATE public.eco_campaign_items
            SET generated_text = v_latest_text, status = 'published', updated_at = now()
            WHERE id = v_item.source_id;

        WHEN 'bulletin' THEN
            -- Integrate with A9 if applicable
            NULL;

        WHEN 'edu_media' THEN
            UPDATE public.edu_media_assets
            SET status = 'published', published_at = now()
            WHERE id = v_item.source_id;

        WHEN 'partner_notes_public' THEN
            -- Integrate with A24
            NULL;
    END CASE;

    UPDATE public.eco_editorial_queue
    SET status = 'published', updated_at = now()
    WHERE id = p_queue_id;

    -- Audit log
    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'editorial_publish', v_item.source_kind, v_item.source_id, jsonb_build_object('queue_id', p_queue_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
