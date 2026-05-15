-- Migration: PEV-01 — Módulo PEV ECO
-- Created: 2026-05-14

-- 1. Helper Function for Cell Access
CREATE OR REPLACE FUNCTION public.fn_current_cell_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    -- Get cell IDs via neighborhood association in profile
    SELECT DISTINCT cell_id 
    FROM public.eco_cell_neighborhoods 
    WHERE neighborhood_id IN (
        SELECT neighborhood_id FROM public.profiles WHERE user_id = p_user_id
    )
    UNION
    -- Or via active role terms in specific cells
    SELECT cell_id FROM public.eco_cell_role_terms WHERE holder_user_id = p_user_id AND status = 'active';
$$;

-- 2. eco_pev_sites
CREATE TABLE IF NOT EXISTS public.eco_pev_sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text UNIQUE,
    address_text text,
    neighborhood text,
    city text DEFAULT 'Volta Redonda',
    state text DEFAULT 'RJ',
    opening_hours jsonb DEFAULT '{}'::jsonb,
    accepted_materials text[] DEFAULT '{}',
    blocked_materials text[] DEFAULT '{}',
    status text DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. eco_pev_lots
CREATE TABLE IF NOT EXISTS public.eco_pev_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    pev_id uuid NOT NULL REFERENCES public.eco_pev_sites(id) ON DELETE CASCADE,
    code text NOT NULL,
    status text DEFAULT 'open' CHECK (status IN ('open','closed','sold','paid','archived')),
    opened_at timestamptz DEFAULT now(),
    closed_at timestamptz,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(pev_id, code)
);

-- 4. eco_pev_entries
CREATE TABLE IF NOT EXISTS public.eco_pev_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    pev_id uuid NOT NULL REFERENCES public.eco_pev_sites(id) ON DELETE CASCADE,
    lot_id uuid REFERENCES public.eco_pev_lots(id) ON DELETE SET NULL,
    material_type text NOT NULL,
    quantity numeric,
    unit text NOT NULL,
    condition text NOT NULL CHECK (condition IN ('clean','mixed','wet','rejected','unsafe')),
    source_type text CHECK (source_type IN ('resident','commerce','school','condominium','association','other')),
    source_neighborhood text,
    photo_url text,
    notes text,
    received_by uuid REFERENCES auth.users(id),
    received_at timestamptz DEFAULT now(),
    status text DEFAULT 'accepted' CHECK (status IN ('accepted','rejected','moved')),
    created_at timestamptz DEFAULT now()
);

-- 5. RLS POLICIES

ALTER TABLE public.eco_pev_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_pev_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_pev_entries ENABLE ROW LEVEL SECURITY;

-- SITES: Select for active or draft (if operator/creator)
CREATE POLICY "Select sites within cell" ON public.eco_pev_sites
    FOR SELECT USING (
        cell_id IN (SELECT public.fn_current_cell_ids(auth.uid()))
        OR (status = 'active') -- Allows public view if needed, but cell isolation is preferred. 
                               -- User requested: "Nunca liberar global sem filtro de cell_id."
                               -- So let's stick to cell isolation.
    );

DROP POLICY IF EXISTS "Select sites within cell" ON public.eco_pev_sites;
CREATE POLICY "Select sites within cell" ON public.eco_pev_sites
    FOR SELECT USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

CREATE POLICY "Manage sites within cell" ON public.eco_pev_sites
    FOR ALL TO authenticated
    USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

-- LOTS
CREATE POLICY "Select lots within cell" ON public.eco_pev_lots
    FOR SELECT USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

CREATE POLICY "Manage lots within cell" ON public.eco_pev_lots
    FOR ALL TO authenticated
    USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

-- ENTRIES
CREATE POLICY "Select entries within cell" ON public.eco_pev_entries
    FOR SELECT USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

CREATE POLICY "Insert entries within cell" ON public.eco_pev_entries
    FOR INSERT TO authenticated
    WITH CHECK (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

CREATE POLICY "Manage entries within cell" ON public.eco_pev_entries
    FOR ALL TO authenticated
    USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_eco_pev_sites_cell ON public.eco_pev_sites(cell_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_sites_status ON public.eco_pev_sites(status);
CREATE INDEX IF NOT EXISTS idx_eco_pev_lots_cell_status ON public.eco_pev_lots(cell_id, status);
CREATE INDEX IF NOT EXISTS idx_eco_pev_lots_pev_status ON public.eco_pev_lots(pev_id, status);
CREATE INDEX IF NOT EXISTS idx_eco_pev_entries_cell_received ON public.eco_pev_entries(cell_id, received_at);
CREATE INDEX IF NOT EXISTS idx_eco_pev_entries_pev_received ON public.eco_pev_entries(pev_id, received_at);
CREATE INDEX IF NOT EXISTS idx_eco_pev_entries_lot ON public.eco_pev_entries(lot_id);

-- 7. Audit Triggers (Optional but good practice in this project)
-- If there is a standard audit function, I should use it.
-- Checked 20260226125000_fix_audit_function.sql before.

-- 8. Seed (Optional example)
-- INSERT INTO public.eco_pev_sites (cell_id, name, slug, neighborhood, status)
-- SELECT id, 'PEV Exemplo Center', 'pev-exemplo-center', 'Centro', 'draft'
-- FROM public.eco_cells WHERE slug = 'volta-redonda' LIMIT 1;
