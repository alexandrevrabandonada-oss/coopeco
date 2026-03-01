-- A33 — Abertura Completa Gradual (Ramp-up & Auto-throttle)
-- supabase/migrations/20260308000000_eco_gradual_opening.sql

-- A) eco_ramp_plans
CREATE TABLE IF NOT EXISTS public.eco_ramp_plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scope text NOT NULL CHECK (scope IN ('cell', 'neighborhood')),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    
    week0_max_new_users_per_day int DEFAULT 20,
    week0_max_new_requests_per_window int DEFAULT 15,
    weekly_growth_pct numeric(5,2) DEFAULT 25.00,
    
    max_cap_users_per_day int DEFAULT 200,
    max_cap_requests_per_window int DEFAULT 50,
    
    min_health_score int DEFAULT 80,
    max_open_incidents_critical int DEFAULT 0,
    block_on_stock_deficit boolean DEFAULT true,
    block_on_feedback_blockers boolean DEFAULT true,
    block_on_obs_critical_burst boolean DEFAULT true,
    
    notes_public text CHECK (char_length(notes_public) <= 200),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT uq_ramp_scope UNIQUE (scope, cell_id, neighborhood_id),
    CONSTRAINT ck_ramp_ids CHECK (
        (scope = 'cell' AND cell_id IS NOT NULL AND neighborhood_id IS NULL) OR
        (scope = 'neighborhood' AND neighborhood_id IS NOT NULL AND cell_id IS NULL)
    )
);

-- B) eco_ramp_state
CREATE TABLE IF NOT EXISTS public.eco_ramp_state (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ramp_plan_id uuid NOT NULL REFERENCES public.eco_ramp_plans(id) ON DELETE CASCADE,
    day date NOT NULL DEFAULT CURRENT_DATE,
    computed_max_new_users_per_day int NOT NULL,
    computed_max_new_requests_per_window int NOT NULL,
    computed_open_mode text NOT NULL DEFAULT 'invite_only' CHECK (computed_open_mode IN ('invite_only', 'open')),
    computed_is_open boolean NOT NULL DEFAULT false,
    computed_reason text CHECK (char_length(computed_reason) <= 200),
    created_at timestamptz DEFAULT now(),
    
    CONSTRAINT uq_ramp_state_day UNIQUE (ramp_plan_id, day)
);

-- C) View pública sanitizada
CREATE OR REPLACE VIEW public.v_ramp_public_status AS
SELECT 
    p.scope,
    CASE 
        WHEN p.scope = 'cell' THEN c.slug 
        ELSE n.slug 
    END as slug,
    s.computed_is_open as is_open,
    s.computed_open_mode as open_mode,
    s.computed_reason as reason,
    p.notes_public,
    s.day as last_updated
FROM public.eco_ramp_plans p
JOIN public.eco_ramp_state s ON s.ramp_plan_id = p.id
LEFT JOIN public.eco_cells c ON p.cell_id = c.id
LEFT JOIN public.neighborhoods n ON p.neighborhood_id = n.id
WHERE p.status = 'active'
AND s.day = CURRENT_DATE;

-- RLS
ALTER TABLE public.eco_ramp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_ramp_state ENABLE ROW LEVEL SECURITY;

-- Planos: Operadores podem tudo
CREATE POLICY "Operators manage ramp plans" ON public.eco_ramp_plans
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));

-- Estado: Operadores leem tudo
CREATE POLICY "Operators read ramp state" ON public.eco_ramp_state
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));

-- RPC refresh_ramp_state
CREATE OR REPLACE FUNCTION public.rpc_refresh_ramp_state(
    p_scope text,
    p_cell_id uuid DEFAULT NULL,
    p_neighborhood_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan RECORD;
    v_week_index int;
    v_max_users int;
    v_max_requests int;
    v_is_open boolean := true;
    v_open_mode text := 'open';
    v_reason text := 'Operação estável';
    v_health_score int;
    v_critical_incidents int;
    v_stock_deficit boolean := false;
    v_feedback_blockers int := 0;
    v_result jsonb;
BEGIN
    -- 1) Find active plan
    SELECT * INTO v_plan
    FROM public.eco_ramp_plans
    WHERE scope = p_scope
    AND (cell_id = p_cell_id OR neighborhood_id = p_neighborhood_id)
    AND status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No active ramp plan found');
    END IF;

    -- 2) Calculate growth
    v_week_index := FLOOR(EXTRACT(DAYS FROM (CURRENT_DATE - v_plan.start_date)) / 7.0);
    IF v_week_index < 0 THEN v_week_index := 0; END IF;

    v_max_users := LEAST(
        FLOOR(v_plan.week0_max_new_users_per_day * POWER(1 + (v_plan.weekly_growth_pct / 100.0), v_week_index)),
        v_plan.max_cap_users_per_day
    );
    
    v_max_requests := LEAST(
        FLOOR(v_plan.week0_max_new_requests_per_window * POWER(1 + (v_plan.weekly_growth_pct / 100.0), v_week_index)),
        v_plan.max_cap_requests_per_window
    );

    -- 3) Check signals
    
    -- Health (A25) - if neighborhood scope
    IF p_scope = 'neighborhood' THEN
        SELECT score INTO v_health_score FROM v_neighborhood_health_score WHERE neighborhood_id = p_neighborhood_id;
        IF v_health_score < v_plan.min_health_score THEN
            v_is_open := false;
            v_reason := 'Saúde do bairro abaixo do limite de segurança';
        END IF;
    END IF;

    -- Incidents (A32)
    SELECT COUNT(*) INTO v_critical_incidents 
    FROM eco_incidents 
    WHERE status != 'resolved' AND severity = 'critical'
    AND (neighborhood_id = p_neighborhood_id OR cell_id = p_cell_id);
    
    IF v_critical_incidents > v_plan.max_open_incidents_critical THEN
        v_is_open := false;
        v_reason := 'Incidentes críticos ativos no território';
    END IF;

    -- Stock (A23) - if neighborhood scope
    IF p_scope = 'neighborhood' AND v_plan.block_on_stock_deficit THEN
        SELECT EXISTS(
            SELECT 1 FROM eco_inventory_stock_check 
            WHERE neighborhood_id = p_neighborhood_id AND is_deficit = true
        ) INTO v_stock_deficit;
        
        IF v_stock_deficit THEN
            v_is_open := false;
            v_reason := 'Déficit de insumos em estoque';
        END IF;
    END IF;

    -- Feedback Blockers (A22)
    IF v_plan.block_on_feedback_blockers THEN
        SELECT COUNT(*) INTO v_feedback_blockers
        FROM eco_feedback_items
        WHERE status = 'open' AND severity = 'blocker'
        AND (neighborhood_id = p_neighborhood_id OR cell_id = p_cell_id);
        
        IF v_feedback_blockers > 0 THEN
            v_is_open := false;
            v_reason := 'Problemas críticos reportados pela comunidade';
        END IF;
    END IF;

    -- Final logic
    IF NOT v_is_open THEN
        v_open_mode := 'invite_only';
    END IF;

    -- 4) Upsert state
    INSERT INTO public.eco_ramp_state (
        ramp_plan_id, day, computed_max_new_users_per_day, computed_max_new_requests_per_window,
        computed_open_mode, computed_is_open, computed_reason
    ) VALUES (
        v_plan.id, CURRENT_DATE, v_max_users, v_max_requests,
        v_open_mode, v_is_open, v_reason
    )
    ON CONFLICT (ramp_plan_id, day) DO UPDATE SET
        computed_max_new_users_per_day = EXCLUDED.computed_max_new_users_per_day,
        computed_max_new_requests_per_window = EXCLUDED.computed_max_new_requests_per_window,
        computed_open_mode = EXCLUDED.computed_open_mode,
        computed_is_open = EXCLUDED.computed_is_open,
        computed_reason = EXCLUDED.computed_reason;

    -- 5) Apply to launch controls (A26)
    UPDATE public.eco_launch_controls
    SET 
        is_open = v_is_open,
        open_mode = v_open_mode,
        max_new_users_per_day = v_max_users,
        max_new_requests_per_window = v_max_requests,
        notes_public = COALESCE(v_plan.notes_public, notes_public),
        updated_at = now()
    WHERE (neighborhood_id = p_neighborhood_id OR cell_id = p_cell_id);

    -- 6) Audit & Events
    INSERT INTO admin_audit_log (user_id, action, entity_type, entity_id, payload)
    VALUES (
        auth.uid(), 
        'ramp_state_refreshed', 
        'ramp_plan', 
        v_plan.id, 
        jsonb_build_object('is_open', v_is_open, 'mode', v_open_mode, 'reason', v_reason)
    );

    IF NOT v_is_open THEN
        INSERT INTO eco_launch_events (neighborhood_id, cell_id, kind, reason)
        VALUES (p_neighborhood_id, p_cell_id, 'throttle_active', v_reason);
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 
        'is_open', v_is_open, 
        'mode', v_open_mode, 
        'max_users', v_max_users,
        'reason', v_reason
    );
END;
$$;
