-- Migration: A51 - Metrics de Impacto (agregadas, anti-ranking)
-- Description: Criação da tabela de rollups semanais de impacto, função RPC agregadora e view pública sanitizada.

-- 1. Tabela de Rollups Semanais de Impacto
CREATE TABLE IF NOT EXISTS public.eco_impact_rollups_weekly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(cell_id, neighborhood_id, week_start)
);

-- RLS: Apenas leitura para autenticados na tabela base (view pública cobre acesso não autenticado se necessário, mas protegeremos a tabela)
ALTER TABLE public.eco_impact_rollups_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operadores podem ver rollups da sua célula"
    ON public.eco_impact_rollups_weekly
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m
            WHERE m.user_id = auth.uid()
            AND m.cell_id = eco_impact_rollups_weekly.cell_id
            AND m.status = 'active'
        )
    );

CREATE POLICY "Admins podem ver todos os rollups"
    ON public.eco_impact_rollups_weekly
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );

-- 2. View Pública Sanitizada (Anti-Ranking)
-- Retorna apenas os agregados seguros para exibição pública, filtrados por bairro ou célula, sem expor incidentes críticos
CREATE OR REPLACE VIEW public.v_impact_public_weekly AS
SELECT 
    cell_id,
    neighborhood_id,
    week_start,
    (metrics->>'receipts_count')::int AS receipts_count,
    (metrics->>'ok_rate')::numeric AS ok_rate,
    (metrics->>'drop_point_share_pct')::numeric AS drop_point_share_pct,
    (metrics->>'recurring_coverage_pct')::numeric AS recurring_coverage_pct,
    (metrics->>'tasks_done_count')::int AS tasks_done_count,
    (metrics->'top_flags') AS top_flags,
    (metrics->>'partners_anchor_active_count')::int AS partners_anchor_active_count
FROM public.eco_impact_rollups_weekly;

-- 3. RPC de Computação de Impacto (Executado por Operadores/Admins ou Cron)
CREATE OR REPLACE FUNCTION public.rpc_compute_impact_rollup(
    p_cell_id UUID,
    p_week_start DATE,
    p_neighborhood_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_metrics JSONB;
    v_receipts_count INT := 0;
    v_ok_count INT := 0;
    v_ok_rate NUMERIC := 0;
    v_tasks_done_count INT := 0;
    v_deficits_count INT := 0;
    v_anchors_count INT := 0;
    
    -- Sub-consultas JSON (top flags e kinds)
    v_top_flags JSONB := '[]'::jsonb;
    v_tasks_kinds JSONB := '{}'::jsonb;
    
    -- Limites de tempo pra semana
    v_week_end DATE := p_week_start + INTERVAL '6 days';
BEGIN
    -- Validação básica de acesso (apenas operadores da célula ou admins)
    IF NOT EXISTS (
        SELECT 1 FROM public.eco_mandates 
        WHERE user_id = auth.uid() AND cell_id = p_cell_id AND status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'
    ) THEN
        RAISE EXCEPTION 'Acesso negado: Apenas operadores da célula podem computar o impacto.';
    END IF;

    -- 1. Contagem de Recibos (Simplificado para o contexto do rollup)
    -- Assumindo que temos a t_receipts já criada nas sprints anteriores. Exemplo: eco_receipts
    -- Por simplicidade estrutural, mockamos a query real adaptando ao schema `receipts` genérico ou `eco_receipts`.
    SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END), 0)
    INTO v_receipts_count, v_ok_count
    FROM public.receipts
    WHERE cell_id = p_cell_id 
      AND (p_neighborhood_id IS NULL OR neighborhood_id = p_neighborhood_id)
      AND created_at >= p_week_start::timestamp 
      AND created_at < (p_week_end + 1)::timestamp;

    IF v_receipts_count > 0 THEN
        v_ok_rate := ROUND((v_ok_count::numeric / v_receipts_count::numeric) * 100, 1);
    END IF;

    -- 2. Tarefas do Comum Concluídas (A50)
    SELECT COUNT(*)
    INTO v_tasks_done_count
    FROM public.eco_common_tasks
    WHERE cell_id = p_cell_id
      AND status = 'done'
      AND updated_at >= p_week_start::timestamp 
      AND updated_at < (p_week_end + 1)::timestamp;
      
    -- Kinds de tarefas
    SELECT jsonb_object_agg(kind, count) INTO v_tasks_kinds
    FROM (
        SELECT kind, COUNT(*) as count
        FROM public.eco_common_tasks
        WHERE cell_id = p_cell_id
          AND status = 'done'
          AND updated_at >= p_week_start::timestamp 
          AND updated_at < (p_week_end + 1)::timestamp
        GROUP BY kind
    ) t;
    
    -- 3. Logística / Déficits de Estoque (A23)
    SELECT COUNT(*)
    INTO v_deficits_count
    FROM public.eco_asset_stocks
    WHERE cell_id = p_cell_id 
      AND qty_on_hand < qty_min;
      
    -- 4. Parceiros / Âncoras Ativos (A24)
    -- Contamos baseado nos bairros (se fornecido) ou total da célula
    -- Vamos contar quantas âncoras estão ativas
    SELECT COUNT(*)
    INTO v_anchors_count
    FROM public.eco_cell_anchors
    WHERE cell_id = p_cell_id
      AND status = 'active'
      AND (p_neighborhood_id IS NULL OR neighborhood_id = p_neighborhood_id);

    -- Compilando Métricas JSON
    v_metrics := jsonb_build_object(
        'receipts_count', COALESCE(v_receipts_count, 0),
        'ok_rate', COALESCE(v_ok_rate, 0),
        'top_flags', v_top_flags, -- Fictício no snippet, pode ser uma select real de flags de erro
        'drop_point_share_pct', 45.2, -- Placeholder de impacto logístico (mock)
        'recurring_coverage_pct', 80.5, -- Placeholder de cobertura (mock)
        'tasks_done_count', COALESCE(v_tasks_done_count, 0),
        'tasks_kinds_counts', COALESCE(v_tasks_kinds, '{}'::jsonb),
        'stock_deficits_count', COALESCE(v_deficits_count, 0),
        'partners_anchor_active_count', COALESCE(v_anchors_count, 0),
        'incidents_critical_count', 0, -- Interno (ex: cruzamento com obs)
        'obs_critical_count', 0
    );

    -- Atualiza (Upsert) a tabela semanal
    INSERT INTO public.eco_impact_rollups_weekly (
        cell_id, 
        neighborhood_id, 
        week_start, 
        metrics
    ) VALUES (
        p_cell_id, 
        p_neighborhood_id, 
        p_week_start, 
        v_metrics
    )
    ON CONFLICT (cell_id, neighborhood_id, week_start)
    DO UPDATE SET 
        metrics = EXCLUDED.metrics,
        created_at = TIMEZONE('utc'::text, NOW());

    RETURN v_metrics;
END;
$$;

-- 4. Integração com Melhoria Contínua (A28)
-- Sobrescrevendo rpc_close_cycle para incluir wins de impacto baseados no A51
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
    v_cycle RECORD;
    v_impact RECORD;
    v_impact_wins jsonb := '[]'::jsonb;
BEGIN
    SELECT * INTO v_cycle FROM public.eco_improvement_cycles WHERE id = p_cycle_id;

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
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_wins
    FROM (
        SELECT title, category FROM public.eco_improvement_items 
        WHERE cycle_id = p_cycle_id AND status = 'done'
        LIMIT 5
    ) sub;

    -- A51: Buscar impacto da semana/mês
    SELECT * INTO v_impact
    FROM public.eco_impact_rollups_weekly
    WHERE cell_id = v_cycle.cell_id
      AND neighborhood_id IS NULL
    ORDER BY week_start DESC
    LIMIT 1;

    IF v_impact.id IS NOT NULL THEN
        IF (v_impact.metrics->>'ok_rate')::numeric >= 80 THEN
            v_impact_wins := v_impact_wins || jsonb_build_object('title', 'Alta Qualidade: ' || (v_impact.metrics->>'ok_rate') || '% na triagem', 'category', 'ops');
        END IF;
        IF (v_impact.metrics->>'tasks_done_count')::int > 0 THEN
            v_impact_wins := v_impact_wins || jsonb_build_object('title', 'Comum Forte: ' || (v_impact.metrics->>'tasks_done_count') || ' tarefas voluntárias concluídas', 'category', 'community');
        END IF;
        
        -- Merge
        v_wins := (v_wins || v_impact_wins);
    END IF;

    -- Update and Insert Rollup
    INSERT INTO public.eco_improvement_rollups (cycle_id, stats, top_blockers, wins)
    VALUES (p_cycle_id, v_stats, COALESCE(v_blockers, '[]'::jsonb), v_wins)
    ON CONFLICT (cycle_id) DO UPDATE SET stats = EXCLUDED.stats, top_blockers = EXCLUDED.top_blockers, wins = EXCLUDED.wins;

    UPDATE public.eco_improvement_cycles SET status = 'closed', updated_at = now() WHERE id = p_cycle_id;

    INSERT INTO public.admin_audit_log (operator_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'close_improvement_cycle', 'eco_improvement_cycle', p_cycle_id, v_stats);

    RETURN v_stats;
END;
$$;
