-- Migration: Ações Operacionais (A15.3)
-- Overrides de capacidade, janelas extras e promoção de pontos ECO.

-- A) Overrides de Janela (Capacidade ou Extra)
CREATE TABLE IF NOT EXISTS public.route_window_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_id UUID NOT NULL REFERENCES public.route_windows(id) ON DELETE CASCADE,
    override_date DATE NOT NULL,
    capacity_override INT,
    is_extra_window BOOLEAN DEFAULT false,
    extra_start_time TIME,
    extra_end_time TIME,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Unique constraint para evitar duplicidade de override/extra na mesma data/hora
    CONSTRAINT unique_window_override UNIQUE NULLS NOT DISTINCT (window_id, override_date, is_extra_window, extra_start_time)
);

-- RLS para overrides
ALTER TABLE public.route_window_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators can manage overrides" ON public.route_window_overrides
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- B) Promoção de Pontos ECO
CREATE TABLE IF NOT EXISTS public.drop_point_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drop_point_id UUID NOT NULL REFERENCES public.eco_drop_points(id) ON DELETE CASCADE,
    neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    message TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para promoções
ALTER TABLE public.drop_point_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active promotions" ON public.drop_point_promotions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators can manage promotions" ON public.drop_point_promotions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- C) View Atualizada: v_window_load_7d
-- Deve incluir janelas extras e aplicar capacity_override
CREATE OR REPLACE VIEW public.v_window_load_7d AS
WITH next_7_days AS (
  SELECT date_trunc('day', d)::date as d
  FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', INTERVAL '1 day') AS d
),
window_occurrences AS (
  -- Janelas regulares (recorrentes)
  SELECT 
    rw.id as window_id,
    rw.neighborhood_id,
    rw.weekday,
    rw.start_time,
    rw.end_time,
    n7.d as scheduled_date,
    COALESCE(rwo.capacity_override, rw.capacity) as capacity,
    false as is_extra
  FROM public.route_windows rw
  CROSS JOIN next_7_days n7
  LEFT JOIN public.route_window_overrides rwo 
    ON rw.id = rwo.window_id 
    AND rwo.override_date = n7.d 
    AND rwo.is_extra_window = false
  WHERE rw.weekday = EXTRACT(DOW FROM n7.d)
  
  UNION ALL
  
  -- Janelas extras
  SELECT 
    rwo.window_id,
    rw.neighborhood_id,
    EXTRACT(DOW FROM rwo.override_date) as weekday,
    rwo.extra_start_time as start_time,
    rwo.extra_end_time as end_time,
    rwo.override_date as scheduled_date,
    rwo.capacity_override as capacity,
    true as is_extra
  FROM public.route_window_overrides rwo
  JOIN public.route_windows rw ON rwo.window_id = rw.id
  WHERE rwo.is_extra_window = true
    AND rwo.override_date >= CURRENT_DATE 
    AND rwo.override_date <= (CURRENT_DATE + INTERVAL '7 days')
),
request_stats AS (
  SELECT 
    window_id,
    scheduled_date,
    COUNT(*) FILTER (WHERE type = 'scheduled') as requests_scheduled_count,
    COUNT(*) FILTER (WHERE type = 'drop_point') as requests_drop_point_count,
    COUNT(*) as requests_total
  FROM public.route_requests
  WHERE status IN ('pending', 'confirmed')
  GROUP BY window_id, scheduled_date
),
recurring_stats AS (
  SELECT 
    window_id,
    COUNT(*) as recurring_count
  FROM public.route_recurring_requests
  WHERE active = true
  GROUP BY window_id
)
SELECT 
  wo.window_id,
  wo.neighborhood_id,
  wo.weekday,
  wo.start_time,
  wo.end_time,
  wo.scheduled_date,
  wo.capacity,
  wo.is_extra,
  COALESCE(rs.requests_scheduled_count, 0) as requests_scheduled_count,
  COALESCE(rs.requests_drop_point_count, 0) as requests_drop_point_count,
  COALESCE(rs.requests_total, 0) as requests_total,
  COALESCE(rec.recurring_count, 0) as recurring_count,
  CASE 
    WHEN wo.capacity > 0 THEN (COALESCE(rec.recurring_count, 0)::float / wo.capacity::float)
    ELSE 0 
  END as recurring_coverage_pct,
  CASE 
    WHEN wo.capacity > 0 THEN (COALESCE(rs.requests_total, 0)::float / wo.capacity::float)
    ELSE 0 
  END as load_ratio,
  CASE
    WHEN wo.capacity > 0 AND (COALESCE(rs.requests_total, 0)::float / wo.capacity::float) >= 0.9 THEN 'critical'
    WHEN wo.capacity > 0 AND (COALESCE(rs.requests_total, 0)::float / wo.capacity::float) >= 0.7 THEN 'warning'
    ELSE 'ok'
  END as status_bucket
FROM window_occurrences wo
LEFT JOIN request_stats rs ON wo.window_id = rs.window_id AND wo.scheduled_date = rs.scheduled_date
LEFT JOIN recurring_stats rec ON wo.window_id = rec.window_id;
