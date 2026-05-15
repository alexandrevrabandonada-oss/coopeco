-- Migration: ECO-D04 — Configuração da Rota Piloto
-- Created: 2026-05-15

-- 1. eco_recycling_pilot_routes
CREATE TABLE IF NOT EXISTS public.eco_recycling_pilot_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    city text DEFAULT 'Volta Redonda',
    neighborhood text,
    zone_id uuid REFERENCES public.eco_recycling_demand_zones(id) ON DELETE SET NULL,
    cell_id uuid, -- Reference to eco_cells if needed later
    
    title text NOT NULL,
    description text,
    route_type text DEFAULT 'pilot' CHECK (route_type IN ('pilot', 'recurring_test', 'special_collection', 'mutirao_support')),
    
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'preparing', 'confirming', 'scheduled', 'in_progress', 'completed', 'canceled', 'archived')),
    
    planned_date date,
    time_window_start time,
    time_window_end time,
    material_focus text[] NOT NULL DEFAULT '{}',
    vehicle_type text,
    operator_name text,
    operator_notes text,
    
    estimated_stops integer DEFAULT 0,
    estimated_volume_score integer DEFAULT 0,
    estimated_duration_minutes integer,
    estimated_distance_km numeric,
    estimated_cost_brl numeric,
    
    actual_stops integer DEFAULT 0,
    actual_volume_score integer DEFAULT 0,
    actual_duration_minutes integer,
    actual_cost_brl numeric,
    completed_at timestamptz,
    
    public_summary_enabled boolean DEFAULT false,
    public_summary_text text
);

-- 2. eco_recycling_pilot_route_stops
CREATE TABLE IF NOT EXISTS public.eco_recycling_pilot_route_stops (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid REFERENCES public.eco_recycling_pilot_routes(id) ON DELETE CASCADE,
    demand_id uuid REFERENCES public.eco_recycling_demands(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    
    stop_order integer DEFAULT 0,
    status text DEFAULT 'planned' CHECK (status IN ('planned', 'needs_confirmation', 'confirmed', 'skipped', 'collected', 'no_show', 'canceled')),
    
    confirmation_status text DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'contacted', 'confirmed', 'refused', 'no_response')),
    confirmed_at timestamptz,
    contacted_at timestamptz,
    
    planned_note text,
    private_address_hint text,
    private_contact_snapshot text,
    
    collected_materials text[] DEFAULT '{}',
    collected_volume_score integer DEFAULT 0,
    issue_note text
);

-- 3. eco_recycling_pilot_route_events
CREATE TABLE IF NOT EXISTS public.eco_recycling_pilot_route_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid REFERENCES public.eco_recycling_pilot_routes(id) ON DELETE CASCADE,
    stop_id uuid REFERENCES public.eco_recycling_pilot_route_stops(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    event_type text NOT NULL,
    old_value text,
    new_value text,
    note text,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_eco_recycling_pilot_routes_status ON public.eco_recycling_pilot_routes(status);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_pilot_routes_planned_date ON public.eco_recycling_pilot_routes(planned_date);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_pilot_routes_zone_id ON public.eco_recycling_pilot_routes(zone_id);

CREATE INDEX IF NOT EXISTS idx_eco_recycling_pilot_route_stops_route_id ON public.eco_recycling_pilot_route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_pilot_route_stops_demand_id ON public.eco_recycling_pilot_route_stops(demand_id);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_pilot_route_stops_status ON public.eco_recycling_pilot_route_stops(status);

-- 5. RLS
ALTER TABLE public.eco_recycling_pilot_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_recycling_pilot_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_recycling_pilot_route_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to pilot routes" ON public.eco_recycling_pilot_routes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to pilot route stops" ON public.eco_recycling_pilot_route_stops
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to pilot route events" ON public.eco_recycling_pilot_route_events
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
