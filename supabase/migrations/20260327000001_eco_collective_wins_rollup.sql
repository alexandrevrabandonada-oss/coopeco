-- Migration: A53.1 - Integração de Vitórias no Rollup de Melhoria
-- Description: Atualiza a RPC do A28 para puxar vitórias coletivas semanais.

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
    v_collective_win RECORD;
    v_collective_wins jsonb := '[]'::jsonb;
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

    -- A53 / A51: Buscar Vitória Coletiva da semana ou Impacto correspondente (para retroalimentar o aprendizado anti-culpa)
    SELECT * INTO v_collective_win
    FROM public.eco_collective_wins_weekly
    WHERE cell_id = v_cycle.cell_id
      AND neighborhood_id IS NULL
    ORDER BY week_start DESC
    LIMIT 1;

    IF v_collective_win.id IS NOT NULL THEN
        -- Adicionar a vitória coletiva e métricas chave
        v_collective_wins := v_collective_wins || jsonb_build_object('title', 'Reconhecimento Célula: ' || v_collective_win.title, 'category', 'community');
        
        IF (v_collective_win.highlights->>'ok_rate')::numeric < 80 AND (v_collective_win.highlights->>'tasks_done_count')::int > 0 THEN
             v_collective_wins := v_collective_wins || jsonb_build_object('title', 'Aprendizado: Qualidade em atenção, mas mobilização comunitária forte.', 'category', 'ops');
        END IF;
        
        -- Merge
        v_wins := (v_wins || v_collective_wins);
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
