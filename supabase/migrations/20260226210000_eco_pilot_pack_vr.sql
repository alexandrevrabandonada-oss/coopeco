-- A9: Pilot Pack VR (config + goals + checklist + weekly transparency)

CREATE TABLE IF NOT EXISTS public.pilot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL UNIQUE REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  default_window_capacity INT NOT NULL DEFAULT 25 CHECK (default_window_capacity > 0),
  default_drop_point_target INT NOT NULL DEFAULT 3 CHECK (default_drop_point_target >= 0),
  anchor_partner_target INT NOT NULL DEFAULT 2 CHECK (anchor_partner_target >= 0),
  weekly_receipts_goal INT NOT NULL DEFAULT 100 CHECK (weekly_receipts_goal >= 0),
  weekly_ok_rate_goal NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (weekly_ok_rate_goal >= 0 AND weekly_ok_rate_goal <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pilot_goals_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  target_receipts INT NOT NULL DEFAULT 0 CHECK (target_receipts >= 0),
  target_ok_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (target_ok_rate >= 0 AND target_ok_rate <= 100),
  target_drop_points INT NOT NULL DEFAULT 0 CHECK (target_drop_points >= 0),
  target_recurring_generated INT NOT NULL DEFAULT 0 CHECK (target_recurring_generated >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (neighborhood_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.pilot_checklist_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  generated_recurring BOOLEAN NOT NULL DEFAULT false,
  operated_queue BOOLEAN NOT NULL DEFAULT false,
  closed_batch BOOLEAN NOT NULL DEFAULT false,
  published_transparency BOOLEAN NOT NULL DEFAULT false,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (neighborhood_id, run_date)
);

CREATE INDEX IF NOT EXISTS idx_pilot_goals_weekly_neighborhood_week
  ON public.pilot_goals_weekly (neighborhood_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_checklist_runs_neighborhood_date
  ON public.pilot_checklist_runs (neighborhood_id, run_date DESC);

DROP TRIGGER IF EXISTS tr_pilot_configs_updated_at ON public.pilot_configs;
CREATE TRIGGER tr_pilot_configs_updated_at
BEFORE UPDATE ON public.pilot_configs
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

DROP TRIGGER IF EXISTS tr_pilot_checklist_runs_updated_at ON public.pilot_checklist_runs;
CREATE TRIGGER tr_pilot_checklist_runs_updated_at
BEFORE UPDATE ON public.pilot_checklist_runs
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

ALTER TABLE public.pilot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_goals_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_checklist_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage pilot configs" ON public.pilot_configs;
CREATE POLICY "Operators manage pilot configs"
ON public.pilot_configs
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators manage pilot goals weekly" ON public.pilot_goals_weekly;
CREATE POLICY "Operators manage pilot goals weekly"
ON public.pilot_goals_weekly
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators manage pilot checklist runs" ON public.pilot_checklist_runs;
CREATE POLICY "Operators manage pilot checklist runs"
ON public.pilot_checklist_runs
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

CREATE OR REPLACE VIEW public.v_transparency_neighborhood_weekly AS
WITH request_base AS (
  SELECT
    pr.neighborhood_id,
    date_trunc('week', COALESCE(pr.scheduled_for, pr.created_at))::date AS week_start,
    pr.id AS request_id,
    pr.fulfillment_mode,
    pr.is_recurring
  FROM public.pickup_requests pr
),
receipt_base AS (
  SELECT
    pr.neighborhood_id,
    date_trunc('week', r.created_at)::date AS week_start,
    r.id AS receipt_id,
    r.quality_status,
    r.contamination_flags
  FROM public.receipts r
  JOIN public.pickup_requests pr ON pr.id = r.request_id
),
flags AS (
  SELECT
    rb.neighborhood_id,
    rb.week_start,
    unnest(COALESCE(rb.contamination_flags, ARRAY[]::TEXT[])) AS flag_name
  FROM receipt_base rb
)
SELECT
  n.id AS neighborhood_id,
  n.slug,
  n.name,
  weeks.week_start,
  (weeks.week_start + INTERVAL '6 days')::date AS week_end,
  COALESCE(req.requests_count, 0)::int AS requests_count,
  COALESCE(req.drop_point_count, 0)::int AS drop_point_count,
  COALESCE(req.recurring_count, 0)::int AS recurring_count,
  COALESCE(rec.receipts_count, 0)::int AS receipts_count,
  COALESCE(rec.ok_rate, 0)::numeric AS ok_rate,
  COALESCE(rec.attention_rate, 0)::numeric AS attention_rate,
  COALESCE(rec.contaminated_rate, 0)::numeric AS contaminated_rate,
  COALESCE((
    SELECT string_agg(flag_name, ', ' ORDER BY c DESC, flag_name)
    FROM (
      SELECT f.flag_name, COUNT(*) AS c
      FROM flags f
      WHERE f.neighborhood_id = n.id
        AND f.week_start = weeks.week_start
        AND f.flag_name IS NOT NULL
        AND f.flag_name <> ''
      GROUP BY f.flag_name
      ORDER BY c DESC, f.flag_name
      LIMIT 3
    ) top
  ), '') AS top_flags
FROM public.neighborhoods n
JOIN (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '12 weeks')::date,
    CURRENT_DATE::date,
    INTERVAL '1 week'
  )::date AS week_start
) weeks ON true
LEFT JOIN (
  SELECT
    neighborhood_id,
    week_start,
    COUNT(DISTINCT request_id) AS requests_count,
    COUNT(DISTINCT request_id) FILTER (WHERE fulfillment_mode = 'drop_point') AS drop_point_count,
    COUNT(DISTINCT request_id) FILTER (WHERE is_recurring = true) AS recurring_count
  FROM request_base
  GROUP BY neighborhood_id, week_start
) req ON req.neighborhood_id = n.id AND req.week_start = weeks.week_start
LEFT JOIN (
  SELECT
    neighborhood_id,
    week_start,
    COUNT(DISTINCT receipt_id) AS receipts_count,
    ROUND((COUNT(*) FILTER (WHERE quality_status = 'ok')::numeric / NULLIF(COUNT(DISTINCT receipt_id), 0)::numeric) * 100, 2) AS ok_rate,
    ROUND((COUNT(*) FILTER (WHERE quality_status = 'attention')::numeric / NULLIF(COUNT(DISTINCT receipt_id), 0)::numeric) * 100, 2) AS attention_rate,
    ROUND((COUNT(*) FILTER (WHERE quality_status = 'contaminated')::numeric / NULLIF(COUNT(DISTINCT receipt_id), 0)::numeric) * 100, 2) AS contaminated_rate
  FROM receipt_base
  GROUP BY neighborhood_id, week_start
) rec ON rec.neighborhood_id = n.id AND rec.week_start = weeks.week_start;

GRANT SELECT ON public.v_transparency_neighborhood_weekly TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
