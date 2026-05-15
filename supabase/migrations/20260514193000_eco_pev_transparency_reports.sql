-- Migration: PEV-03 — Transparência e Boletim Mensal
-- Created: 2026-05-14

-- 1. Add public_transparency to eco_pev_sites
ALTER TABLE public.eco_pev_sites 
ADD COLUMN IF NOT EXISTS public_transparency boolean DEFAULT false;

-- 2. View: eco_pev_monthly_rollups (Internal)
CREATE OR REPLACE VIEW public.eco_pev_monthly_rollups AS
WITH entry_stats AS (
    SELECT 
        cell_id,
        pev_id,
        date_trunc('month', received_at) as month_ref,
        COUNT(id) as total_entries,
        COUNT(id) FILTER (WHERE status = 'accepted') as accepted_entries,
        COUNT(id) FILTER (WHERE status = 'rejected') as rejected_entries
    FROM public.eco_pev_entries
    GROUP BY cell_id, pev_id, date_trunc('month', received_at)
),
lot_stats AS (
    SELECT 
        cell_id,
        pev_id,
        date_trunc('month', COALESCE(sold_at, opened_at)) as month_ref,
        COUNT(id) as total_lots,
        COUNT(id) FILTER (WHERE status = 'open') as open_lots,
        COUNT(id) FILTER (WHERE status = 'closed') as closed_lots,
        COUNT(id) FILTER (WHERE status = 'sold') as sold_lots,
        COUNT(id) FILTER (WHERE status = 'paid') as paid_lots,
        COALESCE(SUM(gross_value), 0) as gross_value_total,
        COALESCE(SUM(total_direct_costs), 0) as direct_costs_total,
        COALESCE(SUM(eco_fund_value), 0) as eco_fund_total,
        COALESCE(SUM(distributable_value), 0) as distributable_total,
        COALESCE(SUM(final_weight_kg), 0) as final_weight_kg_total
    FROM public.eco_pev_lots
    GROUP BY cell_id, pev_id, date_trunc('month', COALESCE(sold_at, opened_at))
)
SELECT 
    COALESCE(e.cell_id, l.cell_id) as cell_id,
    COALESCE(e.pev_id, l.pev_id) as pev_id,
    COALESCE(e.month_ref, l.month_ref) as month_ref,
    COALESCE(e.total_entries, 0) as total_entries,
    COALESCE(e.accepted_entries, 0) as accepted_entries,
    COALESCE(e.rejected_entries, 0) as rejected_entries,
    COALESCE(l.total_lots, 0) as total_lots,
    COALESCE(l.open_lots, 0) as open_lots,
    COALESCE(l.closed_lots, 0) as closed_lots,
    COALESCE(l.sold_lots, 0) as sold_lots,
    COALESCE(l.paid_lots, 0) as paid_lots,
    COALESCE(l.gross_value_total, 0) as gross_value_total,
    COALESCE(l.direct_costs_total, 0) as direct_costs_total,
    COALESCE(l.eco_fund_total, 0) as eco_fund_total,
    COALESCE(l.distributable_total, 0) as distributable_total,
    COALESCE(l.final_weight_kg_total, 0) as final_weight_kg_total
FROM entry_stats e
FULL OUTER JOIN lot_stats l 
  ON e.pev_id = l.pev_id AND e.month_ref = l.month_ref;

-- 3. View: eco_pev_material_monthly_rollups (Internal)
CREATE OR REPLACE VIEW public.eco_pev_material_monthly_rollups AS
SELECT 
    cell_id,
    pev_id,
    date_trunc('month', received_at) as month_ref,
    material_type,
    unit,
    SUM(quantity) as total_quantity,
    COUNT(id) as entry_count,
    COUNT(id) FILTER (WHERE status = 'accepted') as accepted_count,
    COUNT(id) FILTER (WHERE status = 'rejected') as rejected_count,
    COUNT(id) FILTER (WHERE condition = 'clean') as clean_count,
    COUNT(id) FILTER (WHERE condition = 'mixed') as mixed_count,
    COUNT(id) FILTER (WHERE condition = 'wet') as wet_count,
    COUNT(id) FILTER (WHERE condition = 'unsafe') as unsafe_count
FROM public.eco_pev_entries
GROUP BY 
    cell_id,
    pev_id,
    date_trunc('month', received_at),
    material_type,
    unit;

-- 4. View: eco_pev_public_monthly_rollups (Public/Sanitized)
CREATE OR REPLACE VIEW public.eco_pev_public_monthly_rollups AS
SELECT 
    s.id as pev_id,
    s.slug as pev_slug,
    s.name as pev_name,
    s.neighborhood as pev_neighborhood,
    s.city as pev_city,
    s.state as pev_state,
    r.month_ref,
    r.total_entries,
    r.accepted_entries,
    r.sold_lots,
    r.final_weight_kg_total,
    r.gross_value_total,
    r.eco_fund_total
FROM public.eco_pev_sites s
JOIN public.eco_pev_monthly_rollups r ON s.id = r.pev_id
WHERE s.public_transparency = true AND s.status = 'active';

-- Note: RLS is active on underlying tables (eco_pev_sites, entries, lots), 
-- but views created with CREATE VIEW execute with the privileges of the user running the query by default.
-- So fn_current_cell_ids will correctly filter when using Supabase's API.
