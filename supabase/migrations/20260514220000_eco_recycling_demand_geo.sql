-- Migration: ECO-D03 — Mapa Geográfico Interno de Demandas + Zonas de Rota Piloto
-- Created: 2026-05-14

-- 1. Add fields to eco_recycling_demands
ALTER TABLE public.eco_recycling_demands
ADD COLUMN IF NOT EXISTS geo_precision text DEFAULT 'neighborhood' CHECK (geo_precision IN ('neighborhood', 'approximate', 'exact_private', 'unknown')),
ADD COLUMN IF NOT EXISTS geo_status text DEFAULT 'not_geocoded' CHECK (geo_status IN ('not_geocoded', 'geocoded_by_neighborhood', 'geocoded_by_address', 'manual_review', 'failed'));

-- 2. Create eco_recycling_demand_zones Table
CREATE TABLE IF NOT EXISTS public.eco_recycling_demand_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    city text DEFAULT 'Volta Redonda',
    neighborhood text NOT NULL,
    zone_name text NOT NULL,
    zone_type text NOT NULL CHECK (zone_type IN ('bairro', 'microzona', 'rota_piloto', 'pev_area', 'manual')),
    center_lat numeric,
    center_lng numeric,
    radius_m integer,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    notes text
);

-- 3. Create eco_recycling_demand_zone_items Table
CREATE TABLE IF NOT EXISTS public.eco_recycling_demand_zone_items (
    zone_id uuid REFERENCES public.eco_recycling_demand_zones(id) ON DELETE CASCADE,
    demand_id uuid REFERENCES public.eco_recycling_demands(id) ON DELETE CASCADE,
    added_at timestamptz DEFAULT now(),
    added_reason text,
    PRIMARY KEY (zone_id, demand_id)
);

-- 4. RLS for Zones
ALTER TABLE public.eco_recycling_demand_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_recycling_demand_zone_items ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users
CREATE POLICY "Allow authenticated access to demand zones" ON public.eco_recycling_demand_zones
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated access to demand zone items" ON public.eco_recycling_demand_zone_items
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Create Internal View
-- Note: This view specifically excludes sensitive contact info (phone, email, contact_name, operator_notes)
-- and full address hints, protecting PII in the map application layer.
CREATE OR REPLACE VIEW public.eco_recycling_demand_map_internal AS
SELECT 
    d.id,
    d.created_at,
    d.city,
    d.neighborhood,
    d.participant_type,
    d.material_types,
    d.volume_level,
    d.frequency,
    d.preference,
    d.status,
    d.priority,
    d.route_candidate,
    d.pev_candidate,
    d.is_recurring_generator,
    d.can_be_pev,
    d.can_volunteer,
    d.consent_contact,
    d.geo_precision,
    d.geo_status,
    d.lat as geo_lat,
    d.lng as geo_lng
FROM public.eco_recycling_demands d
WHERE d.status != 'archived';

