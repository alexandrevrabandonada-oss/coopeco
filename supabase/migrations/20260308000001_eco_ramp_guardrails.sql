-- A33 — Refinement of Launch Control Guardrails
-- supabase/migrations/20260308000001_eco_ramp_guardrails.sql

CREATE OR REPLACE FUNCTION public.fn_can_create_request(
    p_user_id uuid,
    p_neighborhood_id uuid,
    p_window_id uuid
) RETURNS TABLE (ok boolean, reason text) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_control record;
    v_grant record;
    v_health_score int;
    v_blockers_count int;
    v_current_load int;
    v_critical_incidents int;
BEGIN
    -- 1. Check Access Grant
    SELECT * INTO v_grant FROM public.eco_access_grants WHERE user_id = p_user_id AND active = true;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'user_no_grant';
        RETURN;
    END IF;

    -- 2. Fetch Control (Precedence: Neighborhood > Cell > Global)
    SELECT * INTO v_control FROM public.eco_launch_controls 
    WHERE (scope = 'neighborhood' AND neighborhood_id = p_neighborhood_id)
       OR (scope = 'cell' AND cell_id = (SELECT cell_id FROM public.eco_cell_neighborhoods WHERE neighborhood_id = p_neighborhood_id LIMIT 1))
       OR (scope = 'global')
    ORDER BY CASE WHEN scope = 'neighborhood' THEN 1 WHEN scope = 'cell' THEN 2 ELSE 3 END
    LIMIT 1;

    IF NOT FOUND OR NOT v_control.is_open THEN
        RETURN QUERY SELECT false, 'launch_closed';
        RETURN;
    END IF;

    -- 3. Check Health Score (A25 integration)
    SELECT score INTO v_health_score FROM public.v_neighborhood_health_score WHERE neighborhood_id = p_neighborhood_id;
    
    IF v_health_score < v_control.min_health_score THEN
        RETURN QUERY SELECT false, 'health_blocked';
        RETURN;
    END IF;

    -- 4. Check Blockers (Feedback A22)
    IF v_control.block_on_feedback_blockers THEN
        SELECT COUNT(*) INTO v_blockers_count FROM public.eco_feedback_items 
        WHERE neighborhood_id = p_neighborhood_id AND severity = 'blocker' AND status = 'open';
        
        IF v_blockers_count > 0 THEN
            RETURN QUERY SELECT false, 'feedback_blocked';
            RETURN;
        END IF;
    END IF;

    -- 5. Check Critical Incidents (A32)
    -- This is a new check for A33 auto-throttle
    SELECT COUNT(*) INTO v_critical_incidents 
    FROM public.eco_incidents 
    WHERE status != 'resolved' AND severity = 'critical'
    AND (neighborhood_id = p_neighborhood_id OR cell_id = v_control.cell_id);
    
    IF v_critical_incidents > 0 THEN
        RETURN QUERY SELECT false, 'incident_blocked';
        RETURN;
    END IF;

    -- 6. Check Capacity (Window Load)
    SELECT COUNT(*) INTO v_current_load FROM public.pickup_requests 
    WHERE window_id = p_window_id AND status NOT IN ('cancelled', 'completed');

    -- Note: max_new_requests_per_window is now dynamically updated by rpc_refresh_ramp_state
    IF v_current_load >= v_control.max_new_requests_per_window THEN
        RETURN QUERY SELECT false, 'capacity_blocked';
        RETURN;
    END IF;

    RETURN QUERY SELECT true, 'ok';
END;
$$;
