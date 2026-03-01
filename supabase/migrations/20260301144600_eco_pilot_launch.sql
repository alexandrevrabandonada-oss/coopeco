-- Migration: A57 Pilot Launch Entity & RPCs
-- Purpose: Wizard data structures for controlled opening (Zero PII)

CREATE TABLE public.eco_pilot_launches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'ready', 'live', 'week1', 'paused', 'closed')),
    go_live_date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cell_id, neighborhood_id)
);

CREATE TABLE public.eco_pilot_launch_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    launch_id UUID NOT NULL REFERENCES public.eco_pilot_launches(id) ON DELETE CASCADE,
    step_key TEXT NOT NULL CHECK (step_key IN (
        'ux_readiness_12', 'privacy_audit_pass', 'ramp_plan_set', 
        'launch_controls_set', 'invites_ready', 'kits_ready', 
        'points_ready', 'windows_ready', 'campaign_pack_ready', 
        'learning_focus_ready', 'runbook_ready', 'open_data_ready'
    )),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'blocked')),
    blocked_reason TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(launch_id, step_key)
);

CREATE TABLE public.eco_pilot_launch_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    launch_id UUID NOT NULL REFERENCES public.eco_pilot_launches(id) ON DELETE CASCADE,
    event_kind TEXT NOT NULL CHECK (event_kind IN (
        'init', 'prepared', 'opened_invite_only', 'opened_partial', 
        'paused_health', 'paused_incident', 'day1_completed', 'week1_reviewed'
    )),
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.eco_pilot_launches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_pilot_launch_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_pilot_launch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage pilot_launches" ON public.eco_pilot_launches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('operator', 'moderator')
        )
    );

CREATE POLICY "Operators manage launch_steps" ON public.eco_pilot_launch_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('operator', 'moderator')
        )
    );

CREATE POLICY "Operators manage launch_events" ON public.eco_pilot_launch_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('operator', 'moderator')
        )
    );

---
--- RPCs
---

-- A) Init Pilot Launch
CREATE OR REPLACE FUNCTION public.rpc_init_pilot_launch(p_cell_id UUID, p_neighborhood_id UUID, p_go_live DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_launch_id UUID;
    v_user_role TEXT;
BEGIN
    SELECT role INTO v_user_role FROM public.profiles WHERE user_id = auth.uid();
    IF v_user_role NOT IN ('operator', 'moderator') THEN
        RAISE EXCEPTION 'Access Denied: Operators only';
    END IF;

    -- Upsert the launch
    INSERT INTO public.eco_pilot_launches (cell_id, neighborhood_id, go_live_date, created_by)
    VALUES (p_cell_id, p_neighborhood_id, p_go_live, auth.uid())
    ON CONFLICT (cell_id, neighborhood_id) 
    DO UPDATE SET status = 'planning', go_live_date = EXCLUDED.go_live_date
    RETURNING id INTO v_launch_id;

    -- Seed the 12 tracker steps idempotently
    INSERT INTO public.eco_pilot_launch_steps (launch_id, step_key)
    VALUES 
        (v_launch_id, 'ux_readiness_12'),
        (v_launch_id, 'privacy_audit_pass'),
        (v_launch_id, 'ramp_plan_set'),
        (v_launch_id, 'launch_controls_set'),
        (v_launch_id, 'invites_ready'),
        (v_launch_id, 'kits_ready'),
        (v_launch_id, 'points_ready'),
        (v_launch_id, 'windows_ready'),
        (v_launch_id, 'campaign_pack_ready'),
        (v_launch_id, 'learning_focus_ready'),
        (v_launch_id, 'runbook_ready'),
        (v_launch_id, 'open_data_ready')
    ON CONFLICT (launch_id, step_key) DO NOTHING;

    -- Pre-calculate known states (A25/A56, A34)
    -- UX Readiness check
    IF EXISTS (
        SELECT 1 FROM public.eco_ux_readiness_items 
        WHERE cell_id = p_cell_id AND status = 'todo'
    ) THEN
        UPDATE public.eco_pilot_launch_steps SET status = 'todo' WHERE launch_id = v_launch_id AND step_key = 'ux_readiness_12';
    ELSE
        UPDATE public.eco_pilot_launch_steps SET status = 'done', completed_at = NOW() WHERE launch_id = v_launch_id AND step_key = 'ux_readiness_12';
    END IF;

    -- Runbook criticals check
    IF EXISTS (
        SELECT 1 FROM public.eco_incidents 
        WHERE cell_id = p_cell_id AND status IN ('investigating', 'identified') AND severity IN ('sev1', 'sev2')
    ) THEN
        UPDATE public.eco_pilot_launch_steps SET status = 'blocked', blocked_reason = 'Active Sev1/Sev2 incident' WHERE launch_id = v_launch_id AND step_key = 'runbook_ready';
    ELSE
        UPDATE public.eco_pilot_launch_steps SET status = 'done', completed_at = NOW() WHERE launch_id = v_launch_id AND step_key = 'runbook_ready';
    END IF;

    -- Log Init
    INSERT INTO public.eco_pilot_launch_events (launch_id, event_kind, meta)
    VALUES (v_launch_id, 'init', jsonb_build_object('user_id', auth.uid()));

    RETURN v_launch_id;
END;
$$;

-- B) Prepare Pilot Launch (Day 0)
CREATE OR REPLACE FUNCTION public.rpc_prepare_pilot_launch(p_launch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_launch RECORD;
    v_user_role TEXT;
BEGIN
    SELECT role INTO v_user_role FROM public.profiles WHERE user_id = auth.uid();
    IF v_user_role NOT IN ('operator', 'moderator') THEN
        RAISE EXCEPTION 'Access Denied: Operators only';
    END IF;

    SELECT * INTO v_launch FROM public.eco_pilot_launches WHERE id = p_launch_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- We assume the external server-side API or Admin UI has created invites, campaigns, etc.
    -- This RPC merely enforces setting the states to 'done' when prep runs successfully.
    
    UPDATE public.eco_pilot_launches SET status = 'ready', updated_at = NOW() WHERE id = p_launch_id;

    -- Mark common prep steps as done if they were pending
    UPDATE public.eco_pilot_launch_steps SET status = 'done', completed_at = NOW() 
    WHERE launch_id = p_launch_id AND status = 'todo' AND step_key IN (
        'invites_ready', 'campaign_pack_ready', 'learning_focus_ready', 'open_data_ready'
    );

    INSERT INTO public.eco_pilot_launch_events (launch_id, event_kind)
    VALUES (p_launch_id, 'prepared');

    RETURN TRUE;
END;
$$;

-- C) Open Pilot Invite Only
CREATE OR REPLACE FUNCTION public.rpc_open_pilot_invite_only(p_launch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_launch RECORD;
    v_user_role TEXT;
BEGIN
    SELECT role INTO v_user_role FROM public.profiles WHERE user_id = auth.uid();
    IF v_user_role NOT IN ('operator', 'moderator') THEN
        RAISE EXCEPTION 'Access Denied: Operators only';
    END IF;

    SELECT * INTO v_launch FROM public.eco_pilot_launches WHERE id = p_launch_id;
    
    -- A26 / A33 Enforcement
    INSERT INTO public.eco_launch_controls (neighborhood_id, is_open, daily_quota, current_count)
    VALUES (v_launch.neighborhood_id, true, 20, 0)
    ON CONFLICT (neighborhood_id) 
    DO UPDATE SET is_open = true, daily_quota = 20, current_count = 0;

    INSERT INTO public.eco_ramp_plans (neighborhood_id, open_mode, growth_rate_pct, max_bound)
    VALUES (v_launch.neighborhood_id, 'invite_only', 10, 50)
    ON CONFLICT (neighborhood_id)
    DO UPDATE SET open_mode = 'invite_only', growth_rate_pct = 10, max_bound = 50;

    UPDATE public.eco_pilot_launches SET status = 'live', updated_at = NOW() WHERE id = p_launch_id;
    
    UPDATE public.eco_pilot_launch_steps SET status = 'done', completed_at = NOW() WHERE launch_id = p_launch_id AND step_key IN ('launch_controls_set', 'ramp_plan_set');

    INSERT INTO public.eco_pilot_launch_events (launch_id, event_kind)
    VALUES (p_launch_id, 'opened_invite_only');

    RETURN TRUE;
END;
$$;

-- D) Open Pilot Gradual
CREATE OR REPLACE FUNCTION public.rpc_open_pilot_gradual(p_launch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_launch RECORD;
    v_user_role TEXT;
BEGIN
    SELECT role INTO v_user_role FROM public.profiles WHERE user_id = auth.uid();
    IF v_user_role NOT IN ('operator', 'moderator') THEN
        RAISE EXCEPTION 'Access Denied: Operators only';
    END IF;

    SELECT * INTO v_launch FROM public.eco_pilot_launches WHERE id = p_launch_id;
    
    UPDATE public.eco_launch_controls SET is_open = true, daily_quota = 50 WHERE neighborhood_id = v_launch.neighborhood_id;
    UPDATE public.eco_ramp_plans SET open_mode = 'open' WHERE neighborhood_id = v_launch.neighborhood_id;

    UPDATE public.eco_pilot_launches SET status = 'live', updated_at = NOW() WHERE id = p_launch_id;

    INSERT INTO public.eco_pilot_launch_events (launch_id, event_kind)
    VALUES (p_launch_id, 'opened_partial');

    RETURN TRUE;
END;
$$;

-- E) Pause Pilot (Kill-switch)
CREATE OR REPLACE FUNCTION public.rpc_pause_pilot(p_launch_id UUID, p_reason TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_launch RECORD;
    v_user_role TEXT;
    v_event_kind TEXT;
BEGIN
    SELECT role INTO v_user_role FROM public.profiles WHERE user_id = auth.uid();
    IF v_user_role NOT IN ('operator', 'moderator') THEN
        RAISE EXCEPTION 'Access Denied: Operators only';
    END IF;

    SELECT * INTO v_launch FROM public.eco_pilot_launches WHERE id = p_launch_id;
    
    -- Hard pause via launch controls
    UPDATE public.eco_launch_controls SET is_open = false WHERE neighborhood_id = v_launch.neighborhood_id;
    UPDATE public.eco_pilot_launches SET status = 'paused', updated_at = NOW(), notes = p_reason WHERE id = p_launch_id;

    v_event_kind := CASE 
        WHEN p_reason ILIKE '%incident%' THEN 'paused_incident'
        ELSE 'paused_health'
    END;

    INSERT INTO public.eco_pilot_launch_events (launch_id, event_kind, meta)
    VALUES (p_launch_id, v_event_kind, jsonb_build_object('reason', left(p_reason, 100)));

    RETURN TRUE;
END;
$$;
