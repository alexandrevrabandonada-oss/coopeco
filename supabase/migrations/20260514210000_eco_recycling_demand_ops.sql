-- Migration: ECO-D02 — Painel Operador Avançado (Demanda)
-- Created: 2026-05-14

-- 1. Modify eco_recycling_demands
ALTER TABLE public.eco_recycling_demands
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS next_action text,
ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
ADD COLUMN IF NOT EXISTS converted_at timestamptz,
ADD COLUMN IF NOT EXISTS route_candidate boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pev_candidate boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_weekly_volume_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS operator_assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_operator_action_at timestamptz;

-- 2. Create eco_recycling_demand_events Table
CREATE TABLE IF NOT EXISTS public.eco_recycling_demand_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    demand_id uuid NOT NULL REFERENCES public.eco_recycling_demands(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    event_type text NOT NULL,
    old_value text,
    new_value text,
    note text,
    actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Indexes for Events
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demand_events_demand_id ON public.eco_recycling_demand_events(demand_id);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demand_events_event_type ON public.eco_recycling_demand_events(event_type);
CREATE INDEX IF NOT EXISTS idx_eco_recycling_demand_events_created_at ON public.eco_recycling_demand_events(created_at);

-- 4. RLS for Events
ALTER TABLE public.eco_recycling_demand_events ENABLE ROW LEVEL SECURITY;

-- Note: Depending on existing policies, we might want to restrict this to authenticated only.
-- Let's use a standard authenticated-only policy for read/insert.
CREATE POLICY "Allow authenticated access to demand events" ON public.eco_recycling_demand_events
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
