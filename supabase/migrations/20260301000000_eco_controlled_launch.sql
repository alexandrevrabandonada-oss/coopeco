-- Migration: eco_controlled_launch
-- Controls system access, capacity limits, and health-based kill switches.

-- A) eco_launch_controls (config global e por célula/bairro)
CREATE TABLE IF NOT EXISTS eco_launch_controls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope text NOT NULL CHECK (scope IN ('global', 'cell', 'neighborhood')),
    cell_id uuid REFERENCES eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES neighborhoods(id) ON DELETE CASCADE,
    is_open boolean DEFAULT false,
    open_mode text DEFAULT 'invite_only' CHECK (open_mode IN ('invite_only', 'open')),
    max_new_users_per_day int DEFAULT 50,
    max_new_requests_per_window int DEFAULT 25,
    min_health_score int DEFAULT 80,
    block_on_feedback_blockers boolean DEFAULT true,
    block_on_stock_deficit boolean DEFAULT true,
    notes_public text CHECK (length(notes_public) <= 200),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT launch_scope_unique UNIQUE NULLS NOT DISTINCT (scope, cell_id, neighborhood_id)
);

-- RLS for eco_launch_controls
ALTER TABLE eco_launch_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read launch controls sanitized"
    ON eco_launch_controls FOR SELECT
    USING (true); -- We will filter columns in a view or let app handle it, but keep it simple

CREATE POLICY "Operators write launch controls"
    ON eco_launch_controls FOR ALL
    USING (auth.jwt() ->> 'role' = 'operator')
    WITH CHECK (auth.jwt() ->> 'role' = 'operator');

-- B) eco_access_grants
CREATE TABLE IF NOT EXISTS eco_access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    cell_id uuid REFERENCES eco_cells(id),
    neighborhood_id uuid REFERENCES neighborhoods(id),
    granted_via text NOT NULL CHECK (granted_via IN ('invite', 'pilot', 'admin', 'auto')),
    granted_at timestamptz DEFAULT now(),
    active boolean DEFAULT true,
    CONSTRAINT unique_user_grant UNIQUE (user_id)
);

ALTER TABLE eco_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own grant"
    ON eco_access_grants FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Operators read/write grants"
    ON eco_access_grants FOR ALL
    USING (auth.jwt() ->> 'role' = 'operator')
    WITH CHECK (auth.jwt() ->> 'role' = 'operator');

-- C) eco_launch_events (telemetry)
CREATE TABLE IF NOT EXISTS eco_launch_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope text NOT NULL,
    cell_id uuid,
    neighborhood_id uuid,
    event_kind text NOT NULL CHECK (event_kind IN ('access_granted', 'request_created', 'blocked_health', 'blocked_capacity', 'blocked_policy', 'blocked_launch_closed')),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE eco_launch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators read launch events"
    ON eco_launch_events FOR SELECT
    USING (auth.jwt() ->> 'role' = 'operator');

-- D) Security Definer Function to validate launch conditions
CREATE OR REPLACE FUNCTION fn_can_create_request(
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
    v_stock_deficits int;
    v_current_load int;
BEGIN
    -- 1. Check Access Grant
    SELECT * INTO v_grant FROM eco_access_grants WHERE user_id = p_user_id AND active = true;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'user_no_grant';
        RETURN;
    END IF;

    -- 2. Fetch Control (Precedence: Neighborhood > Cell > Global)
    SELECT * INTO v_control FROM eco_launch_controls 
    WHERE (scope = 'neighborhood' AND neighborhood_id = p_neighborhood_id)
       OR (scope = 'cell' AND cell_id = (SELECT cell_id FROM eco_cell_neighborhoods WHERE neighborhood_id = p_neighborhood_id LIMIT 1))
       OR (scope = 'global')
    ORDER BY CASE WHEN scope = 'neighborhood' THEN 1 WHEN scope = 'cell' THEN 2 ELSE 3 END
    LIMIT 1;

    IF NOT FOUND OR NOT v_control.is_open THEN
        RETURN QUERY SELECT false, 'launch_closed';
        RETURN;
    END IF;

    -- 3. Check Health Score (A25 integration)
    -- We'll use a simplified check here or fetch from the summary logic
    -- For now, let's assume we can query metrics directly for high integrity
    SELECT COALESCE(health_score, 0) INTO v_health_score FROM eco_health_snapshots 
    WHERE neighborhood_id = p_neighborhood_id ORDER BY created_at DESC LIMIT 1;
    
    IF v_health_score < v_control.min_health_score THEN
        RETURN QUERY SELECT false, 'health_blocked';
        RETURN;
    END IF;

    -- 4. Check Blockers (Feedback)
    IF v_control.block_on_feedback_blockers THEN
        SELECT COUNT(*) INTO v_blockers_count FROM eco_feedback_items 
        WHERE neighborhood_id = p_neighborhood_id AND severity = 'blocker' AND status = 'open';
        
        IF v_blockers_count > 0 THEN
            RETURN QUERY SELECT false, 'feedback_blocked';
            RETURN;
        END IF;
    END IF;

    -- 5. Check Capacity (Window Load)
    -- Using the load view or direct count
    SELECT COUNT(*) INTO v_current_load FROM pickup_requests 
    WHERE window_id = p_window_id AND status NOT IN ('cancelled', 'completed');

    IF v_current_load >= v_control.max_new_requests_per_window THEN
        RETURN QUERY SELECT false, 'capacity_blocked';
        RETURN;
    END IF;

    RETURN QUERY SELECT true, 'ok';
END;
$$;

-- E) Trigger BEFORE INSERT on pickup_requests
CREATE OR REPLACE FUNCTION tr_enforce_launch_controls() 
RETURNS TRIGGER AS $$
DECLARE
    v_check record;
BEGIN
    SELECT * INTO v_check FROM fn_can_create_request(NEW.user_id, NEW.neighborhood_id, NEW.window_id);
    
    IF NOT v_check.ok THEN
        -- Log event for telemetry
        INSERT INTO eco_launch_events (scope, neighborhood_id, event_kind)
        VALUES ('neighborhood', NEW.neighborhood_id, 'blocked_' || v_check.reason);
        
        RAISE EXCEPTION 'Launch Control Block: %', v_check.reason;
    END IF;
    
    -- Log success
    INSERT INTO eco_launch_events (scope, neighborhood_id, event_kind)
    VALUES ('neighborhood', NEW.neighborhood_id, 'request_created');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_pickup_requests_launch_guard ON pickup_requests;
CREATE TRIGGER tr_pickup_requests_launch_guard
BEFORE INSERT ON pickup_requests
FOR EACH ROW EXECUTE FUNCTION tr_enforce_launch_controls();

-- Seed Global Control
INSERT INTO eco_launch_controls (scope, is_open, open_mode, notes_public)
VALUES ('global', false, 'invite_only', 'ECO em fase de implantação controlada.')
ON CONFLICT DO NOTHING;
