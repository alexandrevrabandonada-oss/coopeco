-- A36 — Advanced Education Logic
-- supabase/migrations/20260311000100_eco_education_rpc.sql

CREATE OR REPLACE FUNCTION public.rpc_generate_learning_focus(p_neighborhood_id uuid, p_week_start date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_suggested record;
    v_tip_id uuid;
    v_material text;
BEGIN
    -- 1. Get suggested focus from view
    SELECT * INTO v_suggested 
    FROM public.v_learning_focus_suggested_7d 
    WHERE neighborhood_id = p_neighborhood_id;

    -- 2. Pick top tip for this flag
    IF v_suggested.suggested_flag IS NOT NULL THEN
        SELECT id, material INTO v_tip_id, v_material
        FROM public.edu_tips 
        WHERE flag = v_suggested.suggested_flag AND active = true
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Fallback tip if no flag or no specific tip
    IF v_tip_id IS NULL THEN
        SELECT id, material INTO v_tip_id, v_material
        FROM public.edu_tips 
        WHERE flag IS NULL AND active = true
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- 3. Upsert Focus
    INSERT INTO public.eco_neighborhood_learning_focus 
        (neighborhood_id, week_start, focus_flag, focus_material, focus_tip_id, goal_ok_rate)
    VALUES 
        (p_neighborhood_id, p_week_start, COALESCE(v_suggested.suggested_flag, 'none'), v_material, v_tip_id, 85.00)
    ON CONFLICT (neighborhood_id) DO UPDATE SET
        week_start = EXCLUDED.week_start,
        focus_flag = EXCLUDED.focus_flag,
        focus_material = EXCLUDED.focus_material,
        focus_tip_id = EXCLUDED.focus_tip_id,
        updated_at = now();

    -- 4. Upsert Rituals (Standard Template)
    INSERT INTO public.eco_first_week_rituals (neighborhood_id, ritual_key, title, body_md, cta_kind)
    VALUES 
        (p_neighborhood_id, 'week1_day1', 'Dia 1: Separar do jeito certo', 'Nesta semana, nosso bairro está focando em evitar contaminação por ' || COALESCE(v_suggested.suggested_flag, 'resíduos mistos') || '. Confira o guia rápido.', 'read_tip'),
        (p_neighborhood_id, 'week1_day3', 'Dia 3: Ponto ECO e Preparação', 'Como você prepara seu material para a coleta? Veja como facilitar o trabalho do cooperado e garantir a reciclagem.', 'use_drop_point'),
        (p_neighborhood_id, 'week1_day7', 'Dia 7: Resumo e Missão', 'Parabéns pela primeira semana! Participe da missão coletiva do bairro para aumentar nossa taxa de qualidade.', 'do_mission')
    ON CONFLICT (neighborhood_id, ritual_key) DO UPDATE SET
        title = EXCLUDED.title,
        body_md = EXCLUDED.body_md,
        cta_kind = EXCLUDED.cta_kind;

    RETURN jsonb_build_object('success', true, 'focus_flag', v_suggested.suggested_flag, 'tip_id', v_tip_id);
END;
$$;
