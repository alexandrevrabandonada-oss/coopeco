-- A9.1: anchors & commitments + route recurring coverage metric

CREATE TABLE IF NOT EXISTS public.anchor_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('bronze', 'prata', 'ouro')),
  monthly_commitment_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anchor_commitments_partner_status_created
  ON public.anchor_commitments (partner_id, status, created_at DESC);

DROP TRIGGER IF EXISTS tr_anchor_commitments_updated_at ON public.anchor_commitments;
CREATE TRIGGER tr_anchor_commitments_updated_at
BEFORE UPDATE ON public.anchor_commitments
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

ALTER TABLE public.anchor_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anchor commitments public read" ON public.anchor_commitments;
CREATE POLICY "Anchor commitments public read"
ON public.anchor_commitments
FOR SELECT
TO PUBLIC
USING (true);

DROP POLICY IF EXISTS "Operators manage anchor commitments" ON public.anchor_commitments;
CREATE POLICY "Operators manage anchor commitments"
ON public.anchor_commitments
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

CREATE OR REPLACE VIEW public.v_anchor_commitments_export AS
SELECT
  ac.id,
  ac.partner_id,
  p.name AS partner_name,
  p.neighborhood_id,
  ac.level,
  ac.monthly_commitment_text,
  ac.status,
  ac.created_at,
  ac.updated_at
FROM public.anchor_commitments ac
JOIN public.partners p ON p.id = ac.partner_id;

GRANT SELECT ON public.v_anchor_commitments_export TO anon, authenticated;

CREATE OR REPLACE VIEW public.v_route_window_queue_7d AS
SELECT
  rw.id AS window_id,
  rw.neighborhood_id,
  rw.weekday,
  rw.start_time,
  rw.end_time,
  date_trunc('day', pr.scheduled_for)::date AS scheduled_day,
  COUNT(pr.id)::int AS requests_count,
  COUNT(pr.id) FILTER (WHERE pr.fulfillment_mode = 'drop_point')::int AS drop_point_count,
  COUNT(pr.id) FILTER (WHERE pr.fulfillment_mode = 'doorstep')::int AS doorstep_count,
  COUNT(pr.id) FILTER (WHERE pr.is_recurring = true)::int AS recurring_count,
  CASE
    WHEN COUNT(pr.id) = 0 THEN 0::numeric
    ELSE ROUND((COUNT(pr.id) FILTER (WHERE pr.is_recurring = true)::numeric / COUNT(pr.id)::numeric) * 100, 2)
  END AS recurring_coverage_pct
FROM public.route_windows rw
JOIN public.pickup_requests pr
  ON pr.route_window_id = rw.id
WHERE pr.scheduled_for >= (now() - INTERVAL '7 days')
GROUP BY
  rw.id,
  rw.neighborhood_id,
  rw.weekday,
  rw.start_time,
  rw.end_time,
  date_trunc('day', pr.scheduled_for)::date;

GRANT SELECT ON public.v_route_window_queue_7d TO authenticated;

NOTIFY pgrst, 'reload schema';
