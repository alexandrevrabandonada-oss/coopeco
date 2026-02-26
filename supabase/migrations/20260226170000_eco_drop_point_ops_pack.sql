-- A7.2: Ponto ECO Ops Pack (metricas 7d por ponto e por janela)

CREATE OR REPLACE VIEW public.v_drop_point_metrics_7d AS
WITH base AS (
  SELECT
    p.id AS drop_point_id,
    p.name AS drop_point_name,
    p.neighborhood_id,
    pr.id AS request_id,
    r.id AS receipt_id,
    r.quality_status,
    r.contamination_flags
  FROM public.eco_drop_points p
  LEFT JOIN public.pickup_requests pr
    ON pr.drop_point_id = p.id
   AND pr.fulfillment_mode = 'drop_point'
   AND pr.created_at >= (NOW() - INTERVAL '7 days')
  LEFT JOIN public.receipts r
    ON r.request_id = pr.id
)
SELECT
  b.drop_point_id,
  b.drop_point_name,
  b.neighborhood_id,
  COUNT(DISTINCT b.receipt_id) FILTER (WHERE b.receipt_id IS NOT NULL) AS receipts_count,
  COUNT(DISTINCT b.request_id) FILTER (WHERE b.request_id IS NOT NULL) AS requests_count,
  COUNT(*) FILTER (WHERE b.quality_status = 'ok') AS quality_ok_count,
  COUNT(*) FILTER (WHERE b.quality_status = 'attention') AS quality_attention_count,
  COUNT(*) FILTER (WHERE b.quality_status = 'contaminated') AS quality_contaminated_count,
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
    SELECT COALESCE(
      string_agg(flag_name, ', ' ORDER BY flag_count DESC, flag_name),
      ''
    )
    FROM (
      SELECT flag_name, COUNT(*) AS flag_count
      FROM (
        SELECT unnest(COALESCE(b2.contamination_flags, ARRAY[]::text[])) AS flag_name
        FROM base b2
        WHERE b2.drop_point_id = b.drop_point_id
      ) flags
      WHERE flag_name IS NOT NULL AND flag_name <> ''
      GROUP BY flag_name
      ORDER BY flag_count DESC, flag_name
      LIMIT 3
    ) top_flags
  ) AS top_flags
FROM base b
GROUP BY b.drop_point_id, b.drop_point_name, b.neighborhood_id;

CREATE OR REPLACE VIEW public.v_drop_point_metrics_by_window_7d AS
WITH base AS (
  SELECT
    p.id AS drop_point_id,
    p.name AS drop_point_name,
    p.neighborhood_id,
    pr.id AS request_id,
    rw.id AS route_window_id,
    rw.weekday,
    rw.start_time,
    rw.end_time,
    r.id AS receipt_id,
    r.quality_status,
    r.contamination_flags
  FROM public.eco_drop_points p
  LEFT JOIN public.pickup_requests pr
    ON pr.drop_point_id = p.id
   AND pr.fulfillment_mode = 'drop_point'
   AND pr.created_at >= (NOW() - INTERVAL '7 days')
  LEFT JOIN public.route_windows rw
    ON rw.id = pr.route_window_id
  LEFT JOIN public.receipts r
    ON r.request_id = pr.id
)
SELECT
  b.drop_point_id,
  b.drop_point_name,
  b.neighborhood_id,
  b.route_window_id,
  b.weekday,
  b.start_time,
  b.end_time,
  COUNT(DISTINCT b.receipt_id) FILTER (WHERE b.receipt_id IS NOT NULL) AS receipts_count,
  COUNT(DISTINCT b.request_id) FILTER (WHERE b.request_id IS NOT NULL) AS requests_count,
  COUNT(*) FILTER (WHERE b.quality_status = 'ok') AS quality_ok_count,
  COUNT(*) FILTER (WHERE b.quality_status = 'attention') AS quality_attention_count,
  COUNT(*) FILTER (WHERE b.quality_status = 'contaminated') AS quality_contaminated_count,
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
    SELECT COALESCE(
      string_agg(flag_name, ', ' ORDER BY flag_count DESC, flag_name),
      ''
    )
    FROM (
      SELECT flag_name, COUNT(*) AS flag_count
      FROM (
        SELECT unnest(COALESCE(b2.contamination_flags, ARRAY[]::text[])) AS flag_name
        FROM base b2
        WHERE b2.drop_point_id = b.drop_point_id
          AND (
            (b2.route_window_id IS NULL AND b.route_window_id IS NULL)
            OR b2.route_window_id = b.route_window_id
          )
      ) flags
      WHERE flag_name IS NOT NULL AND flag_name <> ''
      GROUP BY flag_name
      ORDER BY flag_count DESC, flag_name
      LIMIT 3
    ) top_flags
  ) AS top_flags
FROM base b
GROUP BY
  b.drop_point_id,
  b.drop_point_name,
  b.neighborhood_id,
  b.route_window_id,
  b.weekday,
  b.start_time,
  b.end_time;

GRANT SELECT ON public.v_drop_point_metrics_7d TO authenticated;
GRANT SELECT ON public.v_drop_point_metrics_by_window_7d TO authenticated;

NOTIFY pgrst, 'reload schema';
