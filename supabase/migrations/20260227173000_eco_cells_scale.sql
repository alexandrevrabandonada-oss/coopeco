-- Migration: A21-ECO — Escala por Células (Sul Fluminense)
-- Created: 2026-02-27

-- 1. Cells
CREATE TABLE IF NOT EXISTS public.eco_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Cell Neighborhoods (Mapping)
CREATE TABLE IF NOT EXISTS public.eco_cell_neighborhoods (
    cell_id UUID REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    PRIMARY KEY (cell_id, neighborhood_id)
);

-- 3. Cell Rollouts
CREATE TABLE IF NOT EXISTS public.eco_cell_rollouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id UUID REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('planning', 'setup', 'running', 'completed')),
    started_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Rollout Steps
CREATE TABLE IF NOT EXISTS public.eco_rollout_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rollout_id UUID REFERENCES public.eco_cell_rollouts(id) ON DELETE CASCADE,
    step_key TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('todo', 'done', 'skipped')),
    meta JSONB DEFAULT '{}'::jsonb,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(rollout_id, step_key)
);

-- 5. RLS Policies

ALTER TABLE public.eco_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_cell_neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_cell_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_rollout_steps ENABLE ROW LEVEL SECURITY;

-- Operator/Admin can do everything
CREATE POLICY "Operators manage cells" ON public.eco_cells
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

CREATE POLICY "Operators manage cell_neighborhoods" ON public.eco_cell_neighborhoods
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

CREATE POLICY "Operators manage rollouts" ON public.eco_cell_rollouts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

CREATE POLICY "Operators manage rollout_steps" ON public.eco_rollout_steps
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

-- Seeding initial cells
INSERT INTO public.eco_cells (name, slug) VALUES 
('Volta Redonda', 'volta-redonda'),
('Barra Mansa', 'barra-mansa'),
('Porto Real', 'porto-real')
ON CONFLICT (slug) DO NOTHING;

-- Map existing pilot neighborhood if possible (Center/Bairro 1)
-- This depends on existing IDs, for now we just seed the tables.
