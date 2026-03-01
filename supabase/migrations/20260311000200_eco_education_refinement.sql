-- A36 Refinement: Supporting Multiple Tips and Automatic Missions
-- supabase/migrations/20260311000200_eco_education_refinement.sql

-- 1. Update Focus table to support multiple tips
ALTER TABLE public.eco_neighborhood_learning_focus 
    DROP COLUMN IF EXISTS focus_tip_id,
    ADD COLUMN IF NOT EXISTS focus_tip_ids uuid[] DEFAULT ARRAY[]::uuid[];

-- 2. Update Rituals table to allow more flexible CTA data
ALTER TABLE public.eco_first_week_rituals
    ADD COLUMN IF NOT EXISTS cta_link text;

-- 3. Update community_missions constraints
ALTER TABLE public.community_missions 
    DROP CONSTRAINT IF EXISTS community_missions_kind_check;

ALTER TABLE public.community_missions 
    ADD CONSTRAINT community_missions_kind_check 
    CHECK (kind IN ('bring_neighbor', 'become_anchor', 'start_recurring', 'reactivate_point', 'quality_push'));

ALTER TABLE public.community_missions 
    ADD CONSTRAINT community_missions_neighborhood_kind_key UNIQUE (neighborhood_id, kind);

-- 4. Update the suggested focus view to include top 3 tips
CREATE OR REPLACE VIEW public.v_learning_focus_suggested_7d AS
WITH flag_stats AS (
    SELECT 
        neighborhood_id,
        unnest(flags) as flag,
        count(*) as flag_count
    FROM public.receipts
    WHERE created_at >= now() - interval '7 days'
      AND flags IS NOT NULL AND array_length(flags, 1) > 0
    GROUP BY 1, 2
),
top_flags AS (
    SELECT 
        neighborhood_id,
        flag,
        flag_count,
        rank() OVER (PARTITION BY neighborhood_id ORDER BY flag_count DESC) as rnk
    FROM flag_stats
),
neighborhood_stats AS (
    SELECT 
        neighborhood_id,
        avg(CASE WHEN quality_status = 'ok' THEN 100 ELSE 0 END) as ok_rate_7d
    FROM public.receipts
    WHERE created_at >= now() - interval '7 days'
    GROUP BY 1
),
suggested_tips AS (
    SELECT 
        tf.neighborhood_id,
        ARRAY_AGG(t.id ORDER BY t.created_at DESC) FILTER (WHERE t.id IS NOT NULL) as tip_ids
    FROM top_flags tf
    LEFT JOIN public.edu_tips t ON t.flag = tf.flag AND t.active = true
    WHERE tf.rnk = 1
    GROUP BY 1
)
SELECT 
    n.id as neighborhood_id,
    tf.flag as suggested_flag,
    ns.ok_rate_7d,
    COALESCE(st.tip_ids[1:3], ARRAY[]::uuid[]) as suggested_tip_ids
FROM public.neighborhoods n
LEFT JOIN top_flags tf ON tf.neighborhood_id = n.id AND tf.rnk = 1
LEFT JOIN neighborhood_stats ns ON ns.neighborhood_id = n.id
LEFT JOIN suggested_tips st ON st.neighborhood_id = n.id;

-- 5. Update RPC to handle multiple tips and create missions
CREATE OR REPLACE FUNCTION public.rpc_generate_learning_focus(p_neighborhood_id uuid, p_week_start date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_suggested record;
    v_tip_ids uuid[];
    v_mission_id uuid;
BEGIN
    -- 1. Get suggested focus from view
    SELECT * INTO v_suggested 
    FROM public.v_learning_focus_suggested_7d 
    WHERE neighborhood_id = p_neighborhood_id;

    -- 2. Tips: use suggested or fallback
    v_tip_ids := v_suggested.suggested_tip_ids;
    
    IF v_tip_ids IS NULL OR array_length(v_tip_ids, 1) = 0 THEN
        SELECT ARRAY_AGG(id) INTO v_tip_ids
        FROM (
            SELECT id FROM public.edu_tips 
            WHERE active = true 
            ORDER BY created_at DESC LIMIT 3
        ) t;
    END IF;

    -- 3. Upsert Focus
    INSERT INTO public.eco_neighborhood_learning_focus 
        (neighborhood_id, week_start, focus_flag, focus_tip_ids, goal_ok_rate)
    VALUES 
        (p_neighborhood_id, p_week_start, COALESCE(v_suggested.suggested_flag, 'none'), v_tip_ids, 85.00)
    ON CONFLICT (neighborhood_id) DO UPDATE SET
        week_start = EXCLUDED.week_start,
        focus_flag = EXCLUDED.focus_flag,
        focus_tip_ids = EXCLUDED.focus_tip_ids,
        updated_at = now();

    -- 4. Ensure Quality Mission exists
    INSERT INTO public.community_missions (neighborhood_id, kind, title, body, active, scope)
    VALUES (
        p_neighborhood_id, 
        'quality_push', 
        'Qualidade do Comum: ' || COALESCE(v_suggested.suggested_flag, 'Geral'),
        'Alcançar 85% de coletas sem contaminação nesta semana.',
        true,
        'neighborhood'
    )
    ON CONFLICT (neighborhood_id, kind) DO UPDATE SET
        title = EXCLUDED.title,
        active = true
    RETURNING id INTO v_mission_id;

    -- Ensure progress record exists
    INSERT INTO public.mission_progress (mission_id, progress_count, goal_count)
    VALUES (v_mission_id, 0, 100)
    ON CONFLICT (mission_id) DO NOTHING;

    -- 5. Upsert Rituals
    INSERT INTO public.eco_first_week_rituals (neighborhood_id, ritual_key, title, body_md, cta_kind)
    VALUES 
        (p_neighborhood_id, 'week1_day1', 'Dia 1: Separar do jeito certo', 'Foco em ' || COALESCE(v_suggested.suggested_flag, 'evitar contaminação') || '.', 'read_tip'),
        (p_neighborhood_id, 'week1_day3', 'Dia 3: Ponto ECO e Preparação', 'Facilite o trabalho do cooperado.', 'use_drop_point'),
        (p_neighborhood_id, 'week1_day7', 'Dia 7: Resumo e Missão', 'Participe da missão coletiva do bairro.', 'do_mission')
    ON CONFLICT (neighborhood_id, ritual_key) DO UPDATE SET
        title = EXCLUDED.title,
        body_md = EXCLUDED.body_md;

    RETURN jsonb_build_object('success', true, 'focus_flag', v_suggested.suggested_flag, 'tip_count', array_length(v_tip_ids, 1));
END;
$$;
