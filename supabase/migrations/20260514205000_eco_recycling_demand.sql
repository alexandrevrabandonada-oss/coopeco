-- Migration: ECO-D01 — Mapeamento de Demanda de Recicláveis
-- Created: 2026-05-14

-- 1. eco_recycling_demands Table
CREATE TABLE IF NOT EXISTS public.eco_recycling_demands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    city text DEFAULT 'Volta Redonda',
    neighborhood text NOT NULL,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE SET NULL,
    
    participant_type text NOT NULL CHECK (participant_type IN ('resident', 'commerce', 'condominium', 'school', 'church', 'association', 'public_space', 'other')),
    material_types text[] NOT NULL DEFAULT '{}',
    volume_level text NOT NULL CHECK (volume_level IN ('small_bag', 'big_bag', 'box', 'many_boxes', 'commercial_volume', 'unknown')),
    frequency text NOT NULL CHECK (frequency IN ('once', 'weekly', 'biweekly', 'monthly', 'recurring_unknown')),
    preference text NOT NULL CHECK (preference IN ('dropoff_pev', 'pickup_request', 'both', 'guidance_only')),
    main_problem text,
    
    can_be_pev boolean DEFAULT false,
    can_volunteer boolean DEFAULT false,
    is_recurring_generator boolean DEFAULT false,
    
    contact_name text,
    contact_phone text,
    contact_email text,
    consent_contact boolean DEFAULT false,
    consent_public_aggregate boolean DEFAULT true,
    
    address_hint text,
    lat numeric,
    lng numeric,
    
    status text DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'contacted', 'mapped', 'converted_to_route', 'converted_to_pev_candidate', 'archived')),
    operator_notes text,
    source text DEFAULT 'public_form',
    ref_code text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demands_neighborhood ON public.eco_recycling_demands(neighborhood);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demands_participant_type ON public.eco_recycling_demands(participant_type);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demands_preference ON public.eco_recycling_demands(preference);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demands_status ON public.eco_recycling_demands(status);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demands_created_at ON public.eco_recycling_demands(created_at);
-- GIN index for arrays if possible, standard B-tree otherwise. Let's use GIN.
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demands_materials ON public.eco_recycling_demands USING GIN (material_types);

-- 3. RLS
ALTER TABLE public.eco_recycling_demands ENABLE ROW LEVEL SECURITY;

-- Note: In Supabase, if we insert via service_role, RLS is bypassed.
-- But if we want to allow public inserts with anon key, we can do:
CREATE POLICY "Allow public insert to demands" ON public.eco_recycling_demands
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Only authenticated users (with correct roles/cells) can select
-- For simplicity, since the admin page is likely protected and global, or cell-specific:
CREATE POLICY "Allow authenticated read demands" ON public.eco_recycling_demands
    FOR SELECT TO authenticated
    USING (
        cell_id IS NULL OR cell_id IN (SELECT public.fn_current_cell_ids(auth.uid()))
    );

CREATE POLICY "Allow authenticated update demands" ON public.eco_recycling_demands
    FOR UPDATE TO authenticated
    USING (
        cell_id IS NULL OR cell_id IN (SELECT public.fn_current_cell_ids(auth.uid()))
    );

-- 4. Public Rollup View (No PII)
CREATE OR REPLACE VIEW public.eco_recycling_demand_rollup_public AS
SELECT 
    d.city,
    d.neighborhood,
    unnest(d.material_types) as material_type,
    d.preference,
    d.participant_type,
    COUNT(d.id) as total_demands,
    COUNT(d.id) FILTER (WHERE d.is_recurring_generator = true) as recurring_generators,
    COUNT(d.id) FILTER (WHERE d.can_be_pev = true) as possible_pevs,
    COUNT(d.id) FILTER (WHERE d.preference IN ('pickup_request', 'both')) as pickup_interest,
    COUNT(d.id) FILTER (WHERE d.preference IN ('dropoff_pev', 'both')) as dropoff_interest,
    MAX(d.created_at) as last_demand_at
FROM public.eco_recycling_demands d
WHERE d.consent_public_aggregate = true AND d.status != 'archived'
GROUP BY 
    d.city,
    d.neighborhood,
    unnest(d.material_types),
    d.preference,
    d.participant_type;
