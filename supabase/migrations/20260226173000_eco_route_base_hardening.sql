-- A7 hardening: janela por bairro + recorrencia + operacao por janela

ALTER TABLE public.route_windows
  ALTER COLUMN capacity SET DEFAULT 25,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.recurring_subscriptions
  ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT NOT NULL DEFAULT 'doorstep' CHECK (fulfillment_mode IN ('doorstep', 'drop_point')),
  ADD COLUMN IF NOT EXISTS drop_point_id UUID REFERENCES public.eco_drop_points(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.eco_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_route_windows_updated_at ON public.route_windows;
CREATE TRIGGER tr_route_windows_updated_at
BEFORE UPDATE ON public.route_windows
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

DROP TRIGGER IF EXISTS tr_recurring_subscriptions_updated_at ON public.recurring_subscriptions;
CREATE TRIGGER tr_recurring_subscriptions_updated_at
BEFORE UPDATE ON public.recurring_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

CREATE OR REPLACE FUNCTION public.eco_next_occurrence(
  weekday INT,
  start_time TIME,
  tz TEXT DEFAULT 'America/Sao_Paulo'
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  local_now TIMESTAMP;
  local_candidate TIMESTAMP;
  day_diff INT;
BEGIN
  local_now := now() AT TIME ZONE tz;
  day_diff := (weekday - EXTRACT(DOW FROM local_now)::INT + 7) % 7;
  local_candidate := date_trunc('day', local_now) + make_interval(days => day_diff) + start_time;

  IF day_diff = 0 AND local_candidate <= local_now THEN
    local_candidate := local_candidate + INTERVAL '7 days';
  END IF;

  RETURN local_candidate AT TIME ZONE tz;
END;
$$;

CREATE OR REPLACE FUNCTION public.eco_validate_pickup_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_active_windows BOOLEAN;
  window_weekday INT;
  window_start TIME;
BEGIN
  IF NEW.route_window_id IS NOT NULL THEN
    SELECT rw.weekday, rw.start_time
    INTO window_weekday, window_start
    FROM public.route_windows rw
    WHERE rw.id = NEW.route_window_id
      AND rw.neighborhood_id = NEW.neighborhood_id;

    IF window_weekday IS NULL THEN
      RAISE EXCEPTION 'route_window_neighborhood_mismatch';
    END IF;

    IF NEW.scheduled_for IS NULL THEN
      NEW.scheduled_for := public.eco_next_occurrence(window_weekday, window_start);
    END IF;
  END IF;

  IF COALESCE(NEW.fulfillment_mode, 'doorstep') = 'doorstep' AND NEW.route_window_id IS NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.route_windows rw
      WHERE rw.neighborhood_id = NEW.neighborhood_id
        AND rw.active = true
    ) INTO has_active_windows;

    IF has_active_windows THEN
      RAISE EXCEPTION 'route_window_required_for_doorstep';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pickup_requests_validate_window ON public.pickup_requests;
CREATE TRIGGER tr_pickup_requests_validate_window
BEFORE INSERT OR UPDATE ON public.pickup_requests
FOR EACH ROW
EXECUTE FUNCTION public.eco_validate_pickup_window();

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
  COUNT(pr.id) FILTER (WHERE pr.fulfillment_mode = 'doorstep')::int AS doorstep_count
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

CREATE OR REPLACE VIEW public.v_route_window_quality_7d AS
WITH base AS (
  SELECT
    rw.id AS window_id,
    r.id AS receipt_id,
    r.quality_status,
    r.contamination_flags
  FROM public.route_windows rw
  LEFT JOIN public.pickup_requests pr
    ON pr.route_window_id = rw.id
  LEFT JOIN public.receipts r
    ON r.request_id = pr.id
   AND r.created_at >= (now() - INTERVAL '7 days')
)
SELECT
  b.window_id,
  COUNT(DISTINCT b.receipt_id) FILTER (WHERE b.receipt_id IS NOT NULL)::int AS receipts_count,
  CASE
    WHEN COUNT(DISTINCT b.receipt_id) FILTER (WHERE b.receipt_id IS NOT NULL) = 0 THEN 0::numeric
    ELSE ROUND(
      (
        COUNT(*) FILTER (WHERE b.quality_status = 'ok')::numeric
        / COUNT(DISTINCT b.receipt_id) FILTER (WHERE b.receipt_id IS NOT NULL)::numeric
      ) * 100,
      2
    )
  END AS ok_rate,
  (
    SELECT COALESCE(string_agg(flag_name, ', ' ORDER BY flag_count DESC, flag_name), '')
    FROM (
      SELECT flag_name, COUNT(*) AS flag_count
      FROM (
        SELECT unnest(COALESCE(b2.contamination_flags, ARRAY[]::TEXT[])) AS flag_name
        FROM base b2
        WHERE b2.window_id = b.window_id
      ) flags
      WHERE flag_name IS NOT NULL AND flag_name <> ''
      GROUP BY flag_name
      ORDER BY flag_count DESC, flag_name
      LIMIT 3
    ) top_flags
  ) AS top_flags
FROM base b
GROUP BY b.window_id;

GRANT SELECT ON public.v_route_window_queue_7d TO authenticated;
GRANT SELECT ON public.v_route_window_quality_7d TO authenticated;

NOTIFY pgrst, 'reload schema';
