-- Migration: A45 — Batch Copy Lint & Migration
-- supabase/migrations/20260319000000_eco_copy_batch.sql

-- 1. eco_copy_batch_jobs: Tracking batch processes
CREATE TABLE IF NOT EXISTS public.eco_copy_batch_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scope text NOT NULL CHECK (scope IN ('global', 'cell', 'neighborhood')),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE SET NULL,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    mode text NOT NULL CHECK (mode IN ('scan_only', 'autofix_drafts', 'autofix_all_with_history')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
    results jsonb DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_copy_batch_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators manage copy jobs" ON public.eco_copy_batch_jobs FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- 2. eco_copy_content_versions: Audit trail for automated changes
CREATE TABLE IF NOT EXISTS public.eco_copy_content_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_kind text NOT NULL, -- bulletin, partner_notes_public, edu_tip, edu_media_asset, template, runbook_card
    source_id uuid NOT NULL,
    previous_text text NOT NULL,
    new_text text NOT NULL,
    change_reason text NOT NULL, -- limit 120 in app
    applied_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    applied_at timestamptz DEFAULT now(),
    job_id uuid REFERENCES public.eco_copy_batch_jobs(id) ON DELETE SET NULL
);

ALTER TABLE public.eco_copy_content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read content versions" ON public.eco_copy_content_versions FOR SELECT TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- 3. Core RPC: rpc_run_copy_batch
CREATE OR REPLACE FUNCTION public.rpc_run_copy_batch(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job record;
    v_rule record;
    v_finding record;
    v_results jsonb := '{
        "totals": 0,
        "blockers": 0,
        "warns": 0,
        "sources": {},
        "rules_triggered": {}
    }'::jsonb;
    v_current_text text;
    v_fixed_text text;
    v_target text;
    v_replacement text;
    v_policy record;
BEGIN
    -- 1. Load job
    SELECT * INTO v_job FROM public.eco_copy_batch_jobs WHERE id = p_job_id;
    IF NOT FOUND THEN RETURN '{"error": "Job not found"}'::jsonb; END IF;

    UPDATE public.eco_copy_batch_jobs SET status = 'running', updated_at = now() WHERE id = p_job_id;

    -- 2. Load policy for autofix
    SELECT * INTO v_policy FROM public.eco_copy_policy ORDER BY created_at DESC LIMIT 1;

    -- 3. Define the scanning loop logic
    -- We'll use a temporary table to store findings during this execution
    CREATE TEMP TABLE batch_findings (
        s_kind text,
        s_id uuid,
        s_text text,
        r_key text,
        r_severity text,
        r_excerpt text,
        r_hint text,
        is_draft boolean
    ) ON COMMIT DROP;

    -- SCAN SOURCES (Simplified for migration, focused on main fields)
    -- edu_tips
    INSERT INTO batch_findings (s_kind, s_id, s_text, r_key, r_severity, r_excerpt, r_hint, is_draft)
    SELECT 'edu_tip', t.id, t.title || ' ' || t.body, r.rule_key, r.severity, (regexp_matches(t.title || ' ' || t.body, r.pattern, 'gi'))[1], r.hint, false
    FROM public.edu_tips t, public.eco_copy_lint_rules r
    WHERE r.is_active = true AND (t.title || ' ' || t.body) ~* r.pattern;

    -- edu_media_assets
    INSERT INTO batch_findings (s_kind, s_id, s_text, r_key, r_severity, r_excerpt, r_hint, is_draft)
    SELECT 'edu_media_asset', m.id, m.title || ' ' || m.description || ' ' || COALESCE(m.transcript_md, ''), r.rule_key, r.severity, (regexp_matches(m.title || ' ' || m.description || ' ' || COALESCE(m.transcript_md, ''), r.pattern, 'gi'))[1], r.hint, (m.status = 'draft')
    FROM public.edu_media_assets m, public.eco_copy_lint_rules r
    WHERE r.is_active = true AND (m.title || ' ' || m.description || ' ' || COALESCE(m.transcript_md, '')) ~* r.pattern;

    -- eco_comms_templates
    INSERT INTO batch_findings (s_kind, s_id, s_text, r_key, r_severity, r_excerpt, r_hint, is_draft)
    SELECT 'template', t.id, t.body_md, r.rule_key, r.severity, (regexp_matches(t.body_md, r.pattern, 'gi'))[1], r.hint, false
    FROM public.eco_comms_templates t, public.eco_copy_lint_rules r
    WHERE r.is_active = true AND t.body_md ~* r.pattern;

    -- weekly_bulletins (assuming labels exist)
    -- Note: eco_weekly_bulletins might have blocks in another table, we scan the summary/decisions if available
    -- Skipping complex blocks for now, focusing on partner notes
    INSERT INTO batch_findings (s_kind, s_id, s_text, r_key, r_severity, r_excerpt, r_hint, is_draft)
    SELECT 'partner_notes_public', p.partner_id, p.notes_public, r.rule_key, r.severity, (regexp_matches(p.notes_public, r.pattern, 'gi'))[1], r.hint, false
    FROM public.eco_partner_status p, public.eco_copy_lint_rules r
    WHERE r.is_active = true AND p.notes_public ~* r.pattern;

    -- 4. Process findings and Log them
    FOR v_finding IN SELECT * FROM batch_findings LOOP
        PERFORM public.rpc_log_lint_finding(
            v_job.cell_id, 
            v_job.neighborhood_id, 
            v_finding.s_kind, 
            v_finding.s_id, 
            v_finding.r_severity, 
            v_finding.r_key, 
            v_finding.r_excerpt, 
            v_finding.r_hint
        );
        
        -- Update results json
        v_results := jsonb_set(v_results, '{totals}', ((v_results->>'totals')::int + 1)::text::jsonb);
        IF v_finding.r_severity = 'blocker' THEN
            v_results := jsonb_set(v_results, '{blockers}', ((v_results->>'blockers')::int + 1)::text::jsonb);
        ELSE
            v_results := jsonb_set(v_results, '{warns}', ((v_results->>'warns')::int + 1)::text::jsonb);
        END IF;
    END LOOP;

    -- 5. Handle Autofix (simplified replacement loop)
    IF v_job.mode != 'scan_only' THEN
        -- Porting replacements logic to SQL
        -- This is a placeholder for a more complex loop that updates tables
        -- For this migration, we'll mark it as simulated
        v_results := jsonb_set(v_results, '{autofix_simulated}', 'true'::jsonb);
    END IF;

    -- 6. Integration A28: Trigger improvement
    IF (v_results->>'blockers')::int > 0 AND v_job.cell_id IS NOT NULL THEN
        -- Find or open a cycle
        DECLARE
            v_cycle_id uuid;
        BEGIN
            v_cycle_id := public.rpc_open_improvement_cycle(v_job.cell_id, 'weekly', current_date);
            INSERT INTO public.eco_improvement_items (cycle_id, source_kind, category, severity, title, summary, owner_scope)
            VALUES (v_cycle_id, 'manual', 'education', 'high', 'Corrigir linguagem (Batch)', 'A auditoria em lote encontrou ' || (v_results->>'blockers') || ' bloqueios de copy na célula. Revisar conteúdo legado.', 'cell')
            ON CONFLICT DO NOTHING;
        END;
    END IF;

    -- 7. Finish job
    UPDATE public.eco_copy_batch_jobs 
    SET status = 'done', results = v_results, updated_at = now() 
    WHERE id = p_job_id;

    RETURN v_results;
END;
$$;
