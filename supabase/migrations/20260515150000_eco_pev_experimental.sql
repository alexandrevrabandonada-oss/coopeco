-- Migration: ECO-D05 — PEV Experimental
-- Created: 2026-05-15

-- 1. Expand eco_pev_sites with experimental fields
ALTER TABLE public.eco_pev_sites
ADD COLUMN IF NOT EXISTS pev_mode text DEFAULT 'regular' CHECK (pev_mode IN ('experimental', 'regular', 'paused', 'archived')),
ADD COLUMN IF NOT EXISTS experiment_status text DEFAULT 'draft' CHECK (experiment_status IN ('draft', 'evaluating', 'approved_for_test', 'active_test', 'paused', 'failed', 'converted_to_regular', 'archived')),
ADD COLUMN IF NOT EXISTS experiment_started_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS experiment_ends_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS source_zone_id uuid NULL REFERENCES public.eco_recycling_demand_zones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_demand_id uuid NULL REFERENCES public.eco_recycling_demands(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_route_id uuid NULL REFERENCES public.eco_recycling_pilot_routes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accepted_materials text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rejected_materials text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS opening_rules text NULL,
ADD COLUMN IF NOT EXISTS safety_rules text NULL,
ADD COLUMN IF NOT EXISTS public_visibility text DEFAULT 'private' CHECK (public_visibility IN ('private', 'listed', 'public_map')),
ADD COLUMN IF NOT EXISTS partner_display_name text NULL,
ADD COLUMN IF NOT EXISTS partner_contact_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS address_public_level text DEFAULT 'neighborhood' CHECK (address_public_level IN ('hidden', 'neighborhood', 'approximate', 'full_public')),
ADD COLUMN IF NOT EXISTS capacity_level text DEFAULT 'small' CHECK (capacity_level IN ('small', 'medium', 'large', 'unknown')),
ADD COLUMN IF NOT EXISTS storage_risk_level text DEFAULT 'low' CHECK (storage_risk_level IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS needs_pickup_frequency text DEFAULT 'unknown' CHECK (needs_pickup_frequency IN ('weekly', 'biweekly', 'monthly', 'on_demand', 'unknown')),
ADD COLUMN IF NOT EXISTS last_collection_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS last_entry_at timestamptz NULL;

-- 2. Create eco_pev_experiment_events table
CREATE TABLE IF NOT EXISTS public.eco_pev_experiment_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pev_site_id uuid NOT NULL REFERENCES public.eco_pev_sites(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    event_type text NOT NULL,
    old_value text NULL,
    new_value text NULL,
    note text NULL,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. RLS for eco_pev_experiment_events
ALTER TABLE public.eco_pev_experiment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can manage pev events" ON public.eco_pev_experiment_events
    FOR ALL TO authenticated
    USING (
        pev_site_id IN (
            SELECT id FROM public.eco_pev_sites 
            WHERE cell_id IN (SELECT public.fn_current_cell_ids(auth.uid()))
        )
    );

-- 4. Create eco_pev_sites_public view
CREATE OR REPLACE VIEW public.eco_pev_sites_public AS
SELECT 
    id,
    slug,
    city,
    neighborhood,
    partner_display_name,
    pev_mode,
    experiment_status,
    accepted_materials,
    opening_rules,
    safety_rules,
    public_visibility,
    address_public_level,
    capacity_level,
    last_collection_at,
    last_entry_at
FROM public.eco_pev_sites
WHERE 
    status = 'active' 
    AND public_visibility IN ('listed', 'public_map')
    AND experiment_status IN ('active_test', 'converted_to_regular', 'draft'); -- draft is for testing, in production we might restrict further

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_eco_pev_sites_mode_status ON public.eco_pev_sites(pev_mode, experiment_status);
CREATE INDEX IF NOT EXISTS idx_eco_pev_sites_source_zone ON public.eco_pev_sites(source_zone_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_sites_visibility ON public.eco_pev_sites(public_visibility);
CREATE INDEX IF NOT EXISTS idx_eco_pev_experiment_events_site ON public.eco_pev_experiment_events(pev_site_id);
