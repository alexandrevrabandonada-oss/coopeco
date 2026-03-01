-- Migration: A43 — Copy Anti-Culpa (Guia de Linguagem e Linter)
-- supabase/migrations/20260317000000_eco_copy_policy.sql

-- A) eco_copy_policy: Language guide policy
CREATE TABLE IF NOT EXISTS public.eco_copy_policy (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    version text UNIQUE NOT NULL, -- ex: v1.0
    principles_md text NOT NULL,
    do_list jsonb NOT NULL DEFAULT '[]'::jsonb,
    dont_list jsonb NOT NULL DEFAULT '[]'::jsonb,
    replacements jsonb NOT NULL DEFAULT '{}'::jsonb, -- { "você": "nós/coletivo" }
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_copy_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read copy policy" ON public.eco_copy_policy FOR SELECT USING (true);
CREATE POLICY "Operators write copy policy" ON public.eco_copy_policy FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- B) eco_copy_lint_rules: Active linting rules
CREATE TABLE IF NOT EXISTS public.eco_copy_lint_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_key text UNIQUE NOT NULL,
    severity text NOT NULL CHECK (severity IN ('warn', 'blocker')),
    pattern text NOT NULL, -- Regex pattern or keyword
    hint text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_copy_lint_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read lint rules" ON public.eco_copy_lint_rules FOR SELECT USING (true);
CREATE POLICY "Operators write lint rules" ON public.eco_copy_lint_rules FOR ALL TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- C) eco_copy_lint_logs: Feedback audit
CREATE TABLE IF NOT EXISTS public.eco_copy_lint_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE SET NULL,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    source_kind text NOT NULL, -- bulletin, card, edu_tip, edu_media_transcript, runbook, partner_notes_public
    source_id uuid NULL,
    severity text NOT NULL,
    rule_key text NOT NULL,
    excerpt text NOT NULL, -- string limit 120
    suggestion text NULL -- string limit 200
);

ALTER TABLE public.eco_copy_lint_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read lint logs" ON public.eco_copy_lint_logs FOR SELECT TO authenticated 
    USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- SEED: Initial Policy v1.0
INSERT INTO public.eco_copy_policy (version, principles_md, do_list, dont_list, replacements)
VALUES (
    'v1.0',
    '# Princípios Anti-Culpa\n1. Educação como cuidado e autonomia.\n2. Responsabilidade coletiva > culpa individual.\n3. Foco no processo e melhoria, não na punição.',
    '["Use nós em vez de você", "Foque na melhoria necessária", "Agradeça pelo cuidado coletivo"]'::jsonb,
    '["Evite apontar erros individuais", "Não use caps lock agressivo", "Elimine termos punitivos"]'::jsonb,
    '{"você": "o coletivo", "erro": "ajuste", "falha": "oportunidade de melhoria", "punição": "correção de rumo"}'::jsonb
) ON CONFLICT (version) DO NOTHING;

-- SEED: Base Lint Rules
INSERT INTO public.eco_copy_lint_rules (rule_key, severity, pattern, hint)
VALUES 
    ('punitive_language', 'blocker', '\berro seu\b|\bfalha sua\b|\bsua culpa\b', 'Use "ajuste necessário" ou "melhoria coletiva". Evite culpar o indivíduo.'),
    ('shame_words', 'blocker', '\bvergonha\b|\babsurdo\b|\binept[oa]\b', 'Linguagem que causa vergonha não educa. Foque no processo técnico.'),
    ('threats', 'blocker', '\bpunição\b|\bmulta\b|\bbloqueio\b', 'Em vez de ameaçar, explique a consequência operacional e o cuidado necessário.'),
    ('blaming_you', 'warn', '\bvocê\b', 'Tente usar "nós", "a célula" ou formas impessoais para reforçar a responsabilidade coletiva.'),
    ('moralizing', 'warn', '\berrado\b|\bmau\b|\bruim\b', 'Use termos técnicos: "contaminado", "fora do padrão", "ajuste pendente".'),
    ('excessive_exclamation', 'warn', '!!!', 'Remova o excesso de exclamação para manter um tom de cuidado sereno.')
ON CONFLICT (rule_key) DO NOTHING;

-- D) RPC to log and potentially trigger improvement
CREATE OR REPLACE FUNCTION public.rpc_log_lint_finding(
    p_cell_id uuid,
    p_neighborhood_id uuid,
    p_source_kind text,
    p_source_id uuid,
    p_severity text,
    p_rule_key text,
    p_excerpt text,
    p_suggestion text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id uuid;
    v_blocker_count int;
    v_cycle_id uuid;
BEGIN
    INSERT INTO public.eco_copy_lint_logs 
        (cell_id, neighborhood_id, source_kind, source_id, severity, rule_key, excerpt, suggestion)
    VALUES 
        (p_cell_id, p_neighborhood_id, p_source_kind, p_source_id, p_severity, p_rule_key, substring(p_excerpt from 1 for 120), substring(p_suggestion from 1 for 200))
    RETURNING id INTO v_log_id;

    -- A28 Integration: Trigger improvement item if blockers recur
    IF p_severity = 'blocker' AND p_cell_id IS NOT NULL THEN
        SELECT count(*) INTO v_blocker_count 
        FROM public.eco_copy_lint_logs 
        WHERE cell_id = p_cell_id 
          AND severity = 'blocker' 
          AND created_at >= (now() - interval '7 days');

        IF v_blocker_count >= 5 THEN
            -- Find or open a cycle
            v_cycle_id := public.rpc_open_improvement_cycle(p_cell_id, 'weekly', current_date);
            
            INSERT INTO public.eco_improvement_items (cycle_id, source_kind, category, severity, title, summary, owner_scope)
            VALUES (v_cycle_id, 'manual', 'education', 'high', 'Ajustar linguagem (anti-culpa)', 'Recorrência de bloqueios de linguagem detectada na última semana. Revisar guias com a célula.', 'cell')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN v_log_id;
END;
$$;
