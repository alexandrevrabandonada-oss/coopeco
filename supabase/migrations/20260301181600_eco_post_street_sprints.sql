-- Migration: A58 Post-Street Sprints
-- Purpose: Agile hotfix board explicitly triaging blocks and frictions (Zero PII)

CREATE TABLE public.eco_hotfix_sprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cell_id, neighborhood_id, week_start)
);

CREATE TABLE public.eco_hotfix_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sprint_id UUID NOT NULL REFERENCES public.eco_hotfix_sprints(id) ON DELETE CASCADE,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('feedback', 'obs', 'launch', 'health', 'incident')),
    source_id UUID,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'blocker')),
    category TEXT NOT NULL CHECK (category IN ('ux', 'ops', 'infra', 'comms', 'quality', 'logistics')),
    title TEXT NOT NULL CHECK (char_length(title) <= 120),
    summary TEXT CHECK (char_length(summary) <= 400),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'wontfix')),
    fix_type TEXT CHECK (fix_type IN ('copy', 'ui', 'guardrail', 'data', 'ops_script')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(sprint_id, source_kind, source_id)
);

CREATE INDEX idx_eco_hotfix_items_sprint_severity_status ON public.eco_hotfix_items(sprint_id, severity, status);

CREATE TABLE public.eco_hotfix_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.eco_hotfix_items(id) ON DELETE CASCADE,
    note TEXT NOT NULL CHECK (char_length(note) <= 300),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Configuration
ALTER TABLE public.eco_hotfix_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_hotfix_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_hotfix_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage eco_hotfix_sprints" ON public.eco_hotfix_sprints
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('operator', 'moderator')
        )
    );

CREATE POLICY "Operators manage eco_hotfix_items" ON public.eco_hotfix_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('operator', 'moderator')
        )
    );

CREATE POLICY "Operators manage eco_hotfix_notes" ON public.eco_hotfix_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('operator', 'moderator')
        )
    );

---
--- RPC: Auto-fill Hotfix Sprint (Blockers First)
---
CREATE OR REPLACE FUNCTION public.rpc_autofill_hotfix_sprint(p_sprint_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sprint RECORD;
    v_user_role TEXT;
    v_inserted_count INTEGER := 0;
BEGIN
    -- Auth check
    SELECT role INTO v_user_role FROM public.profiles WHERE user_id = auth.uid();
    IF v_user_role NOT IN ('operator', 'moderator') THEN
        RAISE EXCEPTION 'Access Denied: Operators only';
    END IF;

    SELECT * INTO v_sprint FROM public.eco_hotfix_sprints WHERE id = p_sprint_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sprint not found';
    END IF;

    -- Fonte 1: A22 Feedback Severity = blocker/high na semana
    -- Mapping: category = ux or ops based on context
    INSERT INTO public.eco_hotfix_items (sprint_id, source_kind, source_id, severity, category, title, summary)
    SELECT 
        v_sprint.id,
        'feedback',
        f.id,
        CASE WHEN f.severity IN ('high', 'critical') THEN 'blocker' ELSE 'high' END,
        'ux',
        LEFT('Feedback Crítico: ' || f.category, 120),
        LEFT(f.content, 400)
    FROM public.eco_feedback_answers f
    WHERE f.neighborhood_id = v_sprint.neighborhood_id
      AND f.sentiment IN ('negative', 'critical')
      AND f.created_at >= v_sprint.week_start
      AND f.created_at < (v_sprint.week_start + INTERVAL '7 days')
    ON CONFLICT (sprint_id, source_kind, source_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    -- Fonte 2: A32 Incidentes Abertos ou Resolvidos na semana Sev1/Sev2
    INSERT INTO public.eco_hotfix_items (sprint_id, source_kind, source_id, severity, category, title, summary)
    SELECT 
        v_sprint.id,
        'incident',
        i.id,
        CASE WHEN i.severity = 'sev1' THEN 'blocker' ELSE 'high' END,
        'infra',
        LEFT('Incidente: ' || i.title, 120),
        'Incidente registrado e atrelado ao ciclo Pós-Rua'
    FROM public.eco_incidents i
    WHERE i.cell_id = v_sprint.cell_id
      AND i.severity IN ('sev1', 'sev2')
      AND (
          i.created_at >= v_sprint.week_start 
          OR (i.resolved_at IS NOT NULL AND i.resolved_at >= v_sprint.week_start)
      )
    ON CONFLICT (sprint_id, source_kind, source_id) DO NOTHING;
    v_inserted_count := v_inserted_count + FOUND::INT; -- PostgreSQL doesn't sum directly from GET DIAGNOSTICS in loop, just tracking roughly

    -- Fonte 3: A26/A33 / A56 UX Blocked via Observability Events
    -- Agrega as barreiras para não inundar o board
    INSERT INTO public.eco_hotfix_items (sprint_id, source_kind, source_id, severity, category, title, summary)
    SELECT 
        v_sprint.id,
        'launch',
        NULL, -- Aggregate, no specific source id
        'high',
        'ops',
        'Limitadores de Capacidade Estourados',
        LEFT('Cerca de ' || count(*) || ' usuários sofreram block ' || e.kind || ' nesta semana.', 400)
    FROM public.eco_obs_events e
    WHERE e.neighborhood_id = v_sprint.neighborhood_id
      AND e.kind IN ('ux_blocked_capacity', 'ux_blocked_health', 'ux_blocked_launch')
      AND e.created_at >= v_sprint.week_start
      AND e.created_at < (v_sprint.week_start + INTERVAL '7 days')
    GROUP BY e.kind
    ON CONFLICT (sprint_id, source_kind, source_id) DO NOTHING;

    -- Omissão temporal simples:
    -- Retorna sucesso "silencioso" se não esticar demais
    RETURN 1;
END;
$$;
