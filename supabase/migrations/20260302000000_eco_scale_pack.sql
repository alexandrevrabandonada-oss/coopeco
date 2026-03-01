-- Migration: A27 — Scale Pack (Sul Fluminense)
-- Reutiliza a infra de A21, A23 e A26 para automação de deploy de novas células.

-- A) eco_cell_templates (Template de implantação)
CREATE TABLE IF NOT EXISTS public.eco_cell_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    name text NOT NULL,
    default_windows jsonb DEFAULT '[]'::jsonb, -- [{weekday: 1, start: "14:00", end: "18:00", capacity: 25}]
    default_assets_min jsonb DEFAULT '{}'::jsonb, -- {"sticker_qr": 10, "operator_badge": 2}
    default_missions jsonb DEFAULT '[]'::jsonb, -- ["Mapear ponto de descarte", "Conversar com síndico"]
    default_launch_controls jsonb DEFAULT '{
        "min_health_score": 80,
        "max_new_requests_per_window": 30,
        "is_open": false,
        "open_mode": "invite_only"
    }'::jsonb,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_cell_templates ENABLE ROW LEVEL SECURITY;

-- Read para todos autenticados (operadores precisam ver para aplicar)
CREATE POLICY "Allow read for authenticated users" ON public.eco_cell_templates
    FOR SELECT TO authenticated USING (true);

-- Escrita apenas para operadores
CREATE POLICY "Allow write for operators" ON public.eco_cell_templates
    FOR ALL TO authenticated 
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));

-- B) eco_cell_rollout_apply_logs (Log de aplicação)
CREATE TABLE IF NOT EXISTS public.eco_cell_rollout_apply_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rollout_id uuid REFERENCES public.eco_cell_rollouts(id) ON DELETE CASCADE,
    template_slug text REFERENCES public.eco_cell_templates(slug),
    applied_at timestamptz DEFAULT now(),
    applied_by uuid REFERENCES auth.users(id),
    summary jsonb DEFAULT '{}'::jsonb -- {neighborhoods: 5, windows: 10, invites: 20}
);

ALTER TABLE public.eco_cell_rollout_apply_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for operators" ON public.eco_cell_rollout_apply_logs
    FOR SELECT TO authenticated 
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));

-- Seed: Template Sul Fluminense v1
INSERT INTO public.eco_cell_templates (slug, name, default_windows, default_assets_min, default_missions)
VALUES (
    'sulfluminense_v1',
    'Sul Fluminense v1.0',
    '[
        {"weekday": 2, "start": "14:00", "end": "17:00", "capacity": 30},
        {"weekday": 4, "start": "09:00", "end": "12:00", "capacity": 30}
    ]'::jsonb,
    '{
        "sticker_qr": 20,
        "operator_badge": 2,
        "a4_drop_point_sign": 5,
        "manual_operador": 1
    }'::jsonb,
    '[
        "Validar ponto de coleta inicial",
        "Distribuir 10 stickers QR",
        "Confirmar horários com a vizinhança"
    ]'::jsonb
) ON CONFLICT (slug) DO NOTHING;


-- C) RPC: rpc_apply_cell_template
-- Automatiza a criação de recursos para uma célula
CREATE OR REPLACE FUNCTION public.rpc_apply_cell_template(
    p_rollout_id uuid,
    p_template_slug text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template record;
    v_neighborhood record;
    v_window jsonb;
    v_asset_slug text;
    v_asset_min int;
    v_mission_title text;
    v_counts jsonb := '{"neighborhoods": 0, "windows": 0, "invites": 0, "controls": 0, "assets": 0, "missions": 0}'::jsonb;
    v_cell_id uuid;
    v_current_user_id uuid := auth.uid();
BEGIN
    -- 1. Get Template
    SELECT * INTO v_template FROM public.eco_cell_templates WHERE slug = p_template_slug;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found', p_template_slug;
    END IF;

    -- 2. Get Rollout & Cell
    SELECT cell_id INTO v_cell_id FROM public.eco_cell_rollouts WHERE id = p_rollout_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rollout % not found', p_rollout_id;
    END IF;

    -- 3. Loop Bairros da Célula (A21)
    FOR v_neighborhood IN 
        SELECT n.id, n.name, n.slug 
        FROM public.neighborhoods n
        JOIN public.eco_cell_neighborhoods ecn ON ecn.neighborhood_id = n.id
        WHERE ecn.cell_id = v_cell_id
    LOOP
        v_counts := jsonb_set(v_counts, '{neighborhoods}', ((v_counts->>'neighborhoods')::int + 1)::text::jsonb);

        -- A) Route Windows
        FOR v_window IN SELECT * FROM jsonb_array_elements(v_template.default_windows)
        LOOP
            INSERT INTO public.route_windows (neighborhood_id, weekday, start_time, end_time, capacity_requests, active)
            VALUES (
                v_neighborhood.id, 
                (v_window->>'weekday')::int, 
                (v_window->>'start')::time, 
                (v_window->>'end')::time, 
                (v_window->>'capacity')::int,
                true
            )
            ON CONFLICT DO NOTHING;
            IF FOUND THEN
                v_counts := jsonb_set(v_counts, '{windows}', ((v_counts->>'windows')::int + 1)::text::jsonb);
            END IF;
        END LOOP;

        -- B) Launch Controls (A26)
        -- Control por bairro
        INSERT INTO public.eco_launch_controls (
            scope, neighborhood_id, is_open, open_mode, 
            min_health_score, max_new_requests_per_window
        )
        VALUES (
            'neighborhood', 
            v_neighborhood.id, 
            (v_template.default_launch_controls->>'is_open')::boolean,
            (v_template.default_launch_controls->>'open_mode'),
            (v_template.default_launch_controls->>'min_health_score')::int,
            (v_template.default_launch_controls->>'max_new_requests_per_window')::int
        )
        ON CONFLICT (scope, neighborhood_id) WHERE scope = 'neighborhood' DO NOTHING;
        
        IF FOUND THEN
            v_counts := jsonb_set(v_counts, '{controls}', ((v_counts->>'controls')::int + 1)::text::jsonb);
        END IF;

        -- C) Invite Codes (Bairro)
        INSERT INTO public.invite_codes (code, neighborhood_id, scope, max_uses)
        VALUES (
            'eco-' || v_neighborhood.slug || '-' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
            v_neighborhood.id,
            'neighborhood',
            50
        )
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
            v_counts := jsonb_set(v_counts, '{invites}', ((v_counts->>'invites')::int + 1)::text::jsonb);
        END IF;

        -- D) Asset Stocks (A23)
        FOR v_asset_slug, v_asset_min IN SELECT * FROM jsonb_each_text(v_template.default_assets_min)
        LOOP
            INSERT INTO public.eco_asset_stocks (neighborhood_id, asset_slug, min_quantity, current_quantity)
            VALUES (v_neighborhood.id, v_asset_slug, v_asset_min, 0)
            ON CONFLICT (neighborhood_id, asset_slug) DO NOTHING;
            IF FOUND THEN
                v_counts := jsonb_set(v_counts, '{assets}', ((v_counts->>'assets')::int + 1)::text::jsonb);
            END IF;
        END LOOP;

        -- E) Community Missions
        FOR v_mission_title IN SELECT * FROM jsonb_array_elements_text(v_template.default_missions)
        LOOP
            INSERT INTO public.community_missions (neighborhood_id, title, description, reward_points, active)
            VALUES (v_neighborhood.id, v_mission_title, 'Missão de implantação da célula.', 10, true)
            ON CONFLICT DO NOTHING;
            IF FOUND THEN
                v_counts := jsonb_set(v_counts, '{missions}', ((v_counts->>'missions')::int + 1)::text::jsonb);
            END IF;
        END LOOP;

    END LOOP;

    -- 4. Launch control por célula
    INSERT INTO public.eco_launch_controls (
        scope, cell_id, is_open, open_mode, 
        min_health_score, max_new_requests_per_window
    )
    VALUES (
        'cell', 
        v_cell_id, 
        (v_template.default_launch_controls->>'is_open')::boolean,
        (v_template.default_launch_controls->>'open_mode'),
        (v_template.default_launch_controls->>'min_health_score')::int,
        (v_template.default_launch_controls->>'max_new_requests_per_window')::int
    )
    ON CONFLICT (scope, cell_id) WHERE scope = 'cell' DO NOTHING;

    -- 5. Log Apply
    INSERT INTO public.eco_cell_rollout_apply_logs (rollout_id, template_slug, applied_by, summary)
    VALUES (p_rollout_id, p_template_slug, v_current_user_id, v_counts);

    -- 6. Update Rollout status (if in setup)
    UPDATE public.eco_cell_rollouts 
    SET status = 'active' 
    WHERE id = p_rollout_id AND status = 'setup';

    -- 7. Audit Log
    INSERT INTO public.admin_audit_log (operator_id, action, target_type, target_id, details)
    VALUES (v_current_user_id, 'apply_template', 'eco_cell_rollout', p_rollout_id, v_counts);

    RETURN v_counts;
END;
$$;
