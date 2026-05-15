-- Migration: PEV-02 — Venda, Custos e Rateio
-- Created: 2026-05-14

-- 1. Expand eco_pev_lots
ALTER TABLE public.eco_pev_lots 
ADD COLUMN IF NOT EXISTS destination_name text,
ADD COLUMN IF NOT EXISTS destination_type text CHECK (destination_type IN ('cooperative','buyer','association','donation','other')),
ADD COLUMN IF NOT EXISTS sold_at timestamptz,
ADD COLUMN IF NOT EXISTS gross_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_weight_kg numeric,
ADD COLUMN IF NOT EXISTS total_direct_costs numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS eco_fund_percent numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS eco_fund_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS distributable_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'draft' CHECK (payout_status IN ('draft','calculated','approved','paid')),
ADD COLUMN IF NOT EXISTS sale_proof_url text,
ADD COLUMN IF NOT EXISTS sale_notes text;

-- 2. eco_pev_lot_costs
CREATE TABLE IF NOT EXISTS public.eco_pev_lot_costs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    lot_id uuid NOT NULL REFERENCES public.eco_pev_lots(id) ON DELETE CASCADE,
    cost_type text NOT NULL CHECK (cost_type IN ('transport','fuel','bags','labels','carretos','maintenance','other')),
    description text,
    amount numeric NOT NULL CHECK (amount >= 0),
    paid_to_label text,
    paid_to_user_id uuid REFERENCES auth.users(id),
    proof_url text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 3. eco_pev_work_logs
CREATE TABLE IF NOT EXISTS public.eco_pev_work_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    lot_id uuid NOT NULL REFERENCES public.eco_pev_lots(id) ON DELETE CASCADE,
    worker_user_id uuid REFERENCES auth.users(id),
    worker_label text NOT NULL,
    work_type text NOT NULL CHECK (work_type IN ('receiving','registering','sorting','loading','transport_selling','coordination','other')),
    hours numeric NOT NULL CHECK (hours > 0),
    weight numeric NOT NULL CHECK (weight > 0),
    points numeric GENERATED ALWAYS AS (hours * weight) STORED,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 4. eco_pev_payouts
CREATE TABLE IF NOT EXISTS public.eco_pev_payouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    lot_id uuid NOT NULL REFERENCES public.eco_pev_lots(id) ON DELETE CASCADE,
    worker_user_id uuid REFERENCES auth.users(id),
    worker_label text NOT NULL,
    points numeric NOT NULL DEFAULT 0,
    work_payment numeric NOT NULL DEFAULT 0,
    reimbursement numeric NOT NULL DEFAULT 0,
    total_payment numeric NOT NULL DEFAULT 0,
    effective_hourly_value numeric,
    status text DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
    paid_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(lot_id, worker_label)
);

-- 5. eco_pev_fund_movements
CREATE TABLE IF NOT EXISTS public.eco_pev_fund_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id uuid NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    lot_id uuid REFERENCES public.eco_pev_lots(id) ON DELETE SET NULL,
    movement_type text NOT NULL CHECK (movement_type IN ('lot_contribution','expense','adjustment')),
    amount numeric NOT NULL,
    description text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 6. RLS POLICIES

ALTER TABLE public.eco_pev_lot_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_pev_work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_pev_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_pev_fund_movements ENABLE ROW LEVEL SECURITY;

-- Pattern: Acesso por cell_id via fn_current_cell_ids

CREATE POLICY "Manage costs within cell" ON public.eco_pev_lot_costs
    FOR ALL TO authenticated
    USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

CREATE POLICY "Manage work_logs within cell" ON public.eco_pev_work_logs
    FOR ALL TO authenticated
    USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

CREATE POLICY "Manage payouts within cell" ON public.eco_pev_payouts
    FOR ALL TO authenticated
    USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

CREATE POLICY "Manage fund_movements within cell" ON public.eco_pev_fund_movements
    FOR ALL TO authenticated
    USING (cell_id IN (SELECT public.fn_current_cell_ids(auth.uid())));

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_eco_pev_lot_costs_cell ON public.eco_pev_lot_costs(cell_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_lot_costs_lot ON public.eco_pev_lot_costs(lot_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_work_logs_cell ON public.eco_pev_work_logs(cell_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_work_logs_lot ON public.eco_pev_work_logs(lot_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_payouts_cell ON public.eco_pev_payouts(cell_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_payouts_lot ON public.eco_pev_payouts(lot_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_payouts_status ON public.eco_pev_payouts(status);
CREATE INDEX IF NOT EXISTS idx_eco_pev_fund_movements_cell ON public.eco_pev_fund_movements(cell_id);
CREATE INDEX IF NOT EXISTS idx_eco_pev_fund_movements_lot ON public.eco_pev_fund_movements(lot_id);
