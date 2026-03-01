-- Migration: A28 — Melhoria Contínua (Continuous Improvement)
-- Integra feedback, saúde, logística e abertura em um ritual semanal/mensal por célula.

-- A) eco_improvement_cycles (Ciclos de melhoria)
CREATE TABLE IF NOT EXISTS public.eco_improvement_cycles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    cycle_kind text NOT NULL CHECK (cycle_kind IN ('weekly', 'monthly')),
    period_start date NOT NULL,
    period_end date NOT NULL,
    status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'published')),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(cell_id, cycle_kind, period_start)
);

ALTER TABLE public.eco_improvement_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for cell operators" ON public.eco_improvement_cycles
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

CREATE POLICY "Allow write for cell operators" ON public.eco_improvement_cycles
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- B) eco_improvement_items (Backlog do ciclo)
CREATE TABLE IF NOT EXISTS public.eco_improvement_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id uuid REFERENCES public.eco_improvement_cycles(id) ON DELETE CASCADE,
    source_kind text NOT NULL CHECK (source_kind IN ('feedback', 'health', 'alerts', 'logistics', 'launch', 'manual')),
    source_id uuid NULL, -- Ref para o item original se houver
    category text DEFAULT 'ops' CHECK (category IN ('ops', 'quality', 'education', 'logistics', 'governance', 'growth', 'infra')),
    severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'blocker')),
    title text NOT NULL,
    summary text,
    status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'wontfix')),
    owner_scope text DEFAULT 'cell' CHECK (owner_scope IN ('cell', 'neighborhood')),
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_improvement_items_cycle_severity ON public.eco_improvement_items(cycle_id, severity, status);

ALTER TABLE public.eco_improvement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read/write for cell operators" ON public.eco_improvement_items
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- C) eco_improvement_rollups (Sumário do Ciclo)
CREATE TABLE IF NOT EXISTS public.eco_improvement_rollups (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id uuid UNIQUE REFERENCES public.eco_improvement_cycles(id) ON DELETE CASCADE,
    stats jsonb DEFAULT '{}'::jsonb, -- {done_count: X, todo_count: Y}
    top_blockers jsonb DEFAULT '[]'::jsonb,
    wins jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_improvement_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for cell operators" ON public.eco_improvement_rollups
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- D) RPC: rpc_open_improvement_cycle
CREATE OR REPLACE FUNCTION public.rpc_open_improvement_cycle(
    p_cell_id uuid,
    p_kind text,
    p_start date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cycle_id uuid;
    v_end date;
BEGIN
    IF p_kind = 'weekly' THEN
        v_end := p_start + interval '6 days';
    ELSE
        v_end := (p_start + interval '1 month') - interval '1 day';
    END IF;

    INSERT INTO public.eco_improvement_cycles (cell_id, cycle_kind, period_start, period_end, created_by)
    VALUES (p_cell_id, p_kind, p_start, v_end, auth.uid())
    ON CONFLICT (cell_id, cycle_kind, period_start) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_cycle_id;

    RETURN v_cycle_id;
END;
$$;

-- E) RPC: rpc_autofill_cycle_items
CREATE OR REPLACE FUNCTION public.rpc_autofill_cycle_items(
    p_cycle_id uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cycle record;
    v_count int := 0;
    v_item record;
BEGIN
    SELECT * INTO v_cycle FROM public.eco_improvement_cycles WHERE id = p_cycle_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    -- 1. Ingerir Feedback (A22)
    FOR v_item IN 
        SELECT id, category, severity, summary, neighborhood_id 
        FROM public.eco_feedback_items 
        WHERE cell_id = v_cycle.cell_id 
          AND status IN ('new', 'triaged')
          AND created_at >= v_cycle.period_start::timestamptz
          AND created_at <= (v_cycle.period_end + 1)::timestamptz
    LOOP
        INSERT INTO public.eco_improvement_items (cycle_id, source_kind, source_id, category, severity, title, summary, neighborhood_id)
        VALUES (p_cycle_id, 'feedback', v_item.id, v_item.category, v_item.severity, 'Feedback da Rua: ' || v_item.category, v_item.summary, v_item.neighborhood_id)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;

    -- 2. Ingerir Saúde (A25) - Se houver scores baixos nos snapshots recentes
    FOR v_item IN
        SELECT neighborhood_id, score, captured_at
        FROM public.eco_system_health_snapshots
        WHERE neighborhood_id IN (SELECT neighborhood_id FROM public.eco_cell_neighborhoods WHERE cell_id = v_cycle.cell_id)
          AND captured_at >= v_cycle.period_start::timestamptz
          AND score < 80
    LOOP
        INSERT INTO public.eco_improvement_items (cycle_id, source_kind, source_id, category, severity, title, summary, neighborhood_id)
        VALUES (p_cycle_id, 'health', v_item.neighborhood_id, 'infra', 'high', 'Saúde do Sistema Baixa: ' || v_item.score || '%', 'A resiliência operacional caiu abaixo do nominal no snapshot de ' || v_item.captured_at::date, v_item.neighborhood_id)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;

    -- 3. Ingerir Logística (A23) - Déficits críticos
    FOR v_item IN
        SELECT neighborhood_id, asset_slug, deficit
        FROM public.v_asset_restock_needed
        WHERE neighborhood_id IN (SELECT neighborhood_id FROM public.eco_cell_neighborhoods WHERE cell_id = v_cycle.cell_id)
          AND deficit > 5
    LOOP
        INSERT INTO public.eco_improvement_items (cycle_id, source_kind, source_id, category, severity, title, summary, neighborhood_id)
        VALUES (p_cycle_id, 'logistics', null, 'logistics', 'high', 'Reposição Crítica: ' || v_item.asset_slug, 'Estoque abaixo do mínimo necessário para a operação.', v_item.neighborhood_id)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;

    -- 4. Ingerir Launch Blocks (A26) - Telemetria de impedimentos
    FOR v_item IN
        SELECT neighborhood_id, block_reason, count(*) as repeats
        FROM public.eco_launch_events
        WHERE event_kind = 'request_blocked'
          AND created_at >= v_cycle.period_start::timestamptz
          AND neighborhood_id IN (SELECT neighborhood_id FROM public.eco_cell_neighborhoods WHERE cell_id = v_cycle.cell_id)
        GROUP BY neighborhood_id, block_reason
        HAVING count(*) > 5
    LOOP
        INSERT INTO public.eco_improvement_items (cycle_id, source_kind, source_id, category, severity, title, summary, neighborhood_id)
        VALUES (p_cycle_id, 'launch', null, 'ops', 'medium', 'Impedimento de Abertura: ' || v_item.block_reason, 'Ocorreram ' || v_item.repeats || ' bloqueios automáticos no período.', v_item.neighborhood_id)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;

    -- 5. Ingerir Falhas Técnicas (A31 Observabilidade)
    FOR v_item IN
        SELECT neighborhood_id, event_kind, count(*) as repeats
        FROM public.eco_obs_events
        WHERE severity IN ('critical', 'error')
          AND created_at >= v_cycle.period_start::timestamptz
          AND neighborhood_id IN (SELECT neighborhood_id FROM public.eco_cell_neighborhoods WHERE cell_id = v_cycle.cell_id)
        GROUP BY neighborhood_id, event_kind
        HAVING count(*) >= 3
    LOOP
        INSERT INTO public.eco_improvement_items (cycle_id, source_kind, source_id, category, severity, title, summary, neighborhood_id)
        VALUES (p_cycle_id, 'alerts', null, 'infra', 'high', 'Falhas Técnicas Recorrentes: ' || v_item.event_kind, 'Detectados ' || v_item.repeats || ' incidentes de ' || v_item.event_kind || ' no período. Verificar logs de observabilidade.', v_item.neighborhood_id)
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

-- F) RPC: rpc_close_cycle
CREATE OR REPLACE FUNCTION public.rpc_close_cycle(
    p_cycle_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats jsonb;
    v_blockers jsonb;
    v_wins jsonb;
BEGIN
    -- Aggregated Stats
    SELECT jsonb_build_object(
        'total', count(*),
        'done', count(*) filter (where status = 'done'),
        'wontfix', count(*) filter (where status = 'wontfix'),
        'todo', count(*) filter (where status = 'todo')
    ) INTO v_stats
    FROM public.eco_improvement_items WHERE cycle_id = p_cycle_id;

    -- Top Blockers
    SELECT jsonb_agg(sub) INTO v_blockers
    FROM (
        SELECT title, severity, category FROM public.eco_improvement_items 
        WHERE cycle_id = p_cycle_id AND severity = 'blocker' AND status != 'done'
        LIMIT 5
    ) sub;

    -- Wins (items done)
    SELECT jsonb_agg(sub) INTO v_wins
    FROM (
        SELECT title, category FROM public.eco_improvement_items 
        WHERE cycle_id = p_cycle_id AND status = 'done'
        LIMIT 5
    ) sub;

    -- Update and Insert Rollup
    INSERT INTO public.eco_improvement_rollups (cycle_id, stats, top_blockers, wins)
    VALUES (p_cycle_id, v_stats, COALESCE(v_blockers, '[]'::jsonb), COALESCE(v_wins, '[]'::jsonb))
    ON CONFLICT (cycle_id) DO UPDATE SET stats = EXCLUDED.stats, top_blockers = EXCLUDED.top_blockers, wins = EXCLUDED.wins;

    UPDATE public.eco_improvement_cycles SET status = 'closed', updated_at = now() WHERE id = p_cycle_id;

    -- Audit
    INSERT INTO public.admin_audit_log (operator_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'close_improvement_cycle', 'eco_improvement_cycle', p_cycle_id, v_stats);

    RETURN v_stats;
END;
$$;
