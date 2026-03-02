-- Migration: A59 Amplified Public Launch (VR) + Corridor
-- Purpose: Automates stability checks and sequences the opening of neighbors

CREATE TABLE public.eco_launch_corridors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) <= 120),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.eco_corridor_neighborhoods (
    corridor_id UUID NOT NULL REFERENCES public.eco_launch_corridors(id) ON DELETE CASCADE,
    neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'invite_only', 'open_gradual', 'open_public', 'paused')),
    opened_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (corridor_id, neighborhood_id)
);

CREATE TABLE public.eco_corridor_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    corridor_id UUID NOT NULL REFERENCES public.eco_launch_corridors(id) ON DELETE CASCADE UNIQUE,
    min_health_score INTEGER NOT NULL DEFAULT 80,
    required_weeks_stable INTEGER NOT NULL DEFAULT 2,
    max_open_incidents_critical INTEGER NOT NULL DEFAULT 0,
    max_stock_deficit_count INTEGER NOT NULL DEFAULT 0,
    max_hotfix_blockers_open INTEGER NOT NULL DEFAULT 0,
    weekly_growth_pct NUMERIC(5,2) NOT NULL DEFAULT 25.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.eco_launch_corridors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_corridor_neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_corridor_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage eco_launch_corridors" ON public.eco_launch_corridors
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND role IN ('operator', 'moderator')));

CREATE POLICY "Operators manage eco_corridor_neighborhoods" ON public.eco_corridor_neighborhoods
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND role IN ('operator', 'moderator')));

CREATE POLICY "Operators manage eco_corridor_rules" ON public.eco_corridor_rules
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND role IN ('operator', 'moderator')));

--
-- View: Estabilidade Agregada (2 Semanas)
-- Sumariza do A25, A32, A23, A58
--
CREATE OR REPLACE VIEW public.v_neighborhood_stability_2w AS
SELECT n.id AS neighborhood_id, n.cell_id,
    -- Simulating reading from A25 snapshots last 14 days
    (SELECT count(*) FROM public.eco_metric_records m 
      WHERE m.neighborhood_id = n.id AND m.metric_key = 'ops_health' AND (m.value::numeric) >= 80 
      AND m.created_at >= timezone('utc'::text, now()) - INTERVAL '14 days'
    ) / 7 AS health_ok_weeks, 

    -- Simulating reading from A32 Incidents opened or active in last 14 days
    (SELECT count(*) FROM public.eco_incidents i 
      WHERE i.cell_id = n.cell_id AND i.severity IN ('sev1', 'sev2') 
      AND (i.resolved_at IS NULL OR i.resolved_at >= timezone('utc'::text, now()) - INTERVAL '14 days')
    ) AS current_critical_incidents,

    -- Hotfix blockers A58
    (SELECT count(*) FROM public.eco_hotfix_items h 
     JOIN public.eco_hotfix_sprints hs ON hs.id = h.sprint_id 
     WHERE hs.neighborhood_id = n.id AND h.severity = 'blocker' AND h.status != 'done'
    ) AS open_blockers

FROM public.neighborhoods n;

---
--- RPC 1: Sugerir Próximo do Corredor (Apenas Sugestão Segura)
---
CREATE OR REPLACE FUNCTION public.rpc_suggest_corridor_next_open(p_corridor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rules RECORD;
    v_current_active RECORD;
    v_next_candidate RECORD;
    v_stability RECORD;
    v_pass BOOLEAN := TRUE;
    v_reasons TEXT[] := '{}';
    v_recommendation TEXT := 'Manter fechado';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator','moderator')) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    SELECT * INTO v_rules FROM public.eco_corridor_rules WHERE corridor_id = p_corridor_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Rules not found'; END IF;

    -- Descobre o último bairro que foi aberto
    SELECT * INTO v_current_active FROM public.eco_corridor_neighborhoods 
      WHERE corridor_id = p_corridor_id AND status != 'queued' 
      ORDER BY order_index DESC LIMIT 1;
      
    -- Descobre o próximo da fila
    SELECT * INTO v_next_candidate FROM public.eco_corridor_neighborhoods 
      WHERE corridor_id = p_corridor_id AND status = 'queued' 
      ORDER BY order_index ASC LIMIT 1;

    IF v_next_candidate IS NULL THEN
        RETURN jsonb_build_object('finished', true, 'message', 'Corredor totalmente processado.');
    END IF;

    IF v_current_active IS NOT NULL THEN
        -- Verifica estabilidade do Predecessor (Quem abriu o caminho)
        SELECT * INTO v_stability FROM public.v_neighborhood_stability_2w WHERE neighborhood_id = v_current_active.neighborhood_id;
        
        IF COALESCE(v_stability.health_ok_weeks, 0) < v_rules.required_weeks_stable THEN
            v_pass := FALSE;
            v_reasons := array_append(v_reasons, 'Predecessor não manteve Health > 80 por ' || v_rules.required_weeks_stable || ' semanas (A25).');
        END IF;

        IF COALESCE(v_stability.current_critical_incidents, 0) > v_rules.max_open_incidents_critical THEN
            v_pass := FALSE;
            v_reasons := array_append(v_reasons, 'Incidentes Críticos abertos na Célula (A32).');
        END IF;

        IF COALESCE(v_stability.open_blockers, 0) > v_rules.max_hotfix_blockers_open THEN
            v_pass := FALSE;
            v_reasons := array_append(v_reasons, 'Blockers Pós-Rua ainda abertos no predecessor (A58).');
        END IF;
    END IF;

    IF v_pass THEN
        v_recommendation := 'Abrir invite_only';
    END IF;

    RETURN jsonb_build_object(
        'candidate_neighborhood_id', v_next_candidate.neighborhood_id,
        'readiness', v_pass,
        'reasons', v_reasons,
        'recommendation', v_recommendation
    );
END;
$$;

---
--- RPC 2: Aplicar Abertura do Corredor (Auto-provisioning)
---
CREATE OR REPLACE FUNCTION public.rpc_apply_corridor_opening(
    p_corridor_id UUID, 
    p_neighborhood_id UUID, 
    p_mode TEXT -- 'invite_only', 'open_gradual', 'open_public'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cell_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator','moderator')) THEN
        RAISE EXCEPTION 'Access Denied';
    END IF;

    SELECT cell_id INTO v_cell_id FROM public.eco_launch_corridors WHERE id = p_corridor_id;

    -- Update Corridor Pipeline
    UPDATE public.eco_corridor_neighborhoods 
       SET status = p_mode, opened_at = COALESCE(opened_at, timezone('utc'::text, now()))
     WHERE corridor_id = p_corridor_id AND neighborhood_id = p_neighborhood_id;

    -- Update A33 Ramp Plan Limitadores
    -- Se for public não tem cap na base (`target_users`)
    INSERT INTO public.eco_ramp_plans (neighborhood_id, cell_id, target_users, active_users, onboarding_speed_week, status)
    VALUES (
        p_neighborhood_id, 
        v_cell_id, 
        CASE WHEN p_mode = 'invite_only' THEN 30 WHEN p_mode = 'open_gradual' THEN 100 ELSE 99999 END, 
        0, 
        CASE WHEN p_mode = 'invite_only' THEN 5 ELSE 50 END,
        'active'
    )
    ON CONFLICT (neighborhood_id) DO UPDATE 
    SET target_users = EXCLUDED.target_users, onboarding_speed_week = EXCLUDED.onboarding_speed_week;

    -- Release Open Data Feeds (A54) for this neighborhood (Impact, Wins, Bulletins)
    INSERT INTO public.eco_open_data_feeds (neighborhood_id, cell_id, dataset, is_enabled)
    VALUES 
        (p_neighborhood_id, v_cell_id, 'impact_weekly', true),
        (p_neighborhood_id, v_cell_id, 'wins_weekly', true),
        (p_neighborhood_id, v_cell_id, 'bulletins', true)
    ON CONFLICT (neighborhood_id, dataset) DO UPDATE SET is_enabled = true;

    -- Publish "Bem-Vindo" Win (A53) auto-generated if it does not exist
    INSERT INTO public.eco_collective_wins (neighborhood_id, cell_id, week_start, title, body_md)
    SELECT 
        p_neighborhood_id, v_cell_id, date_trunc('week', now())::date, 
        'Portões Abertos!', 'Hoje expandimos a rede. Celebrem cada material inserido (Sem PII).'
    WHERE NOT EXISTS (
        SELECT 1 FROM public.eco_collective_wins WHERE neighborhood_id = p_neighborhood_id
    );

    RETURN TRUE;
END;
$$;
