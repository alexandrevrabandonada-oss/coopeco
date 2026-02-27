-- Phase A15: Inteligência de Rotas v0
-- Aggregated operational views for load, quality, and trends.

-- Helper for window labels in views
CREATE OR REPLACE FUNCTION format_window_label_lite(p_weekday INT, p_start TEXT, p_end TEXT)
RETURNS TEXT AS $$
DECLARE
  days TEXT[] := ARRAY['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
BEGIN
  RETURN days[p_weekday + 1] || ' ' || substring(p_start from 1 for 5) || '-' || substring(p_end from 1 for 5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- A) View: v_window_load_7d
-- Shows load per route window occurrence for the current and next week.
CREATE OR REPLACE VIEW v_window_load_7d AS
WITH window_occurrences AS (
  -- Current and next occurrence for each active window
  SELECT 
    rw.id as window_id,
    rw.neighborhood_id,
    rw.weekday,
    rw.start_time,
    rw.end_time,
    rw.capacity,
    eco_next_occurrence(rw.weekday, rw.start_time, 'America/Sao_Paulo') as scheduled_date
  FROM route_windows rw
  WHERE rw.active = true
),
request_aggregates AS (
  SELECT 
    route_window_id,
    scheduled_for::date as scheduled_date,
    COUNT(*) FILTER (WHERE fulfillment_mode = 'doorstep') as doorstep_count,
    COUNT(*) FILTER (WHERE fulfillment_mode = 'drop_point') as drop_point_count,
    COUNT(*) as total_count
  FROM pickup_requests
  WHERE status IN ('open', 'accepted', 'en_route', 'collected')
    AND scheduled_for >= CURRENT_DATE - INTERVAL '1 day'
    AND scheduled_for <= CURRENT_DATE + INTERVAL '14 days'
  GROUP BY route_window_id, scheduled_for::date
),
recurring_stats AS (
  SELECT 
    preferred_window_id,
    COUNT(*) as active_recurring_count
  FROM recurring_subscriptions
  WHERE status = 'active'
  GROUP BY preferred_window_id
)
SELECT 
  wo.window_id,
  wo.neighborhood_id,
  wo.weekday,
  wo.start_time,
  wo.end_time,
  wo.scheduled_date,
  wo.capacity,
  COALESCE(ra.doorstep_count, 0) as requests_scheduled_count,
  COALESCE(ra.drop_point_count, 0) as requests_drop_point_count,
  COALESCE(ra.total_count, 0) as requests_total,
  COALESCE(rs.active_recurring_count, 0) as recurring_count,
  CASE 
    WHEN ra.total_count > 0 THEN (COALESCE(rs.active_recurring_count, 0)::float / ra.total_count) 
    ELSE 0 
  END as recurring_coverage_pct,
  CASE 
    WHEN wo.capacity > 0 THEN (COALESCE(ra.total_count, 0)::float / wo.capacity)
    ELSE 0
  END as load_ratio,
  CASE 
    WHEN wo.capacity > 0 AND (COALESCE(ra.total_count, 0)::float / wo.capacity) >= 0.95 THEN 'critical'
    WHEN wo.capacity > 0 AND (COALESCE(ra.total_count, 0)::float / wo.capacity) >= 0.7 THEN 'warning'
    ELSE 'ok'
  END as status_bucket
FROM window_occurrences wo
LEFT JOIN request_aggregates ra ON ra.route_window_id = wo.window_id AND ra.scheduled_date = wo.scheduled_date::date
LEFT JOIN recurring_stats rs ON rs.preferred_window_id = wo.window_id;

-- B) View: v_window_quality_7d
-- Quality rate and top flags per window in the last 7 days.
CREATE OR REPLACE VIEW v_window_quality_7d AS
WITH window_receipts AS (
  SELECT 
    pr.route_window_id,
    COUNT(r.id) as receipts_count,
    COUNT(*) FILTER (WHERE r.quality_status = 'ok') as ok_count,
    COUNT(*) FILTER (WHERE r.quality_status = 'attention') as attention_count,
    COUNT(*) FILTER (WHERE r.quality_status = 'contaminated') as contaminated_count
  FROM receipts r
  JOIN pickup_requests pr ON r.request_id = pr.id
  WHERE r.created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY pr.route_window_id
),
flattened_flags AS (
  SELECT 
    pr.route_window_id,
    unnest(r.contamination_flags) as flag
  FROM receipts r
  JOIN pickup_requests pr ON r.request_id = pr.id
  WHERE r.created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND r.contamination_flags IS NOT NULL
),
top_flags AS (
  SELECT 
    route_window_id,
    array_agg(flag) as flags_list
  FROM (
    SELECT route_window_id, flag, COUNT(*) as cnt
    FROM flattened_flags
    GROUP BY route_window_id, flag
    ORDER BY route_window_id, cnt DESC
    LIMIT 3
  ) s
  GROUP BY route_window_id
)
SELECT 
  wr.route_window_id as window_id,
  SUM(wr.receipts_count) as receipts_count,
  CASE WHEN SUM(wr.receipts_count) > 0 THEN SUM(wr.ok_count)::float / SUM(wr.receipts_count) ELSE 0 END as ok_rate,
  CASE WHEN SUM(wr.receipts_count) > 0 THEN SUM(wr.attention_count)::float / SUM(wr.receipts_count) ELSE 0 END as attention_rate,
  CASE WHEN SUM(wr.receipts_count) > 0 THEN SUM(wr.contaminated_count)::float / SUM(wr.receipts_count) ELSE 0 END as contaminated_rate,
  COALESCE(tf.flags_list, ARRAY[]::text[]) as top_flags
FROM window_receipts wr
LEFT JOIN top_flags tf ON tf.route_window_id = wr.route_window_id
GROUP BY wr.route_window_id, tf.flags_list;

-- C) View: v_drop_point_load_7d
CREATE OR REPLACE VIEW v_drop_point_load_7d AS
WITH dp_stats AS (
  SELECT 
    pr.drop_point_id,
    COUNT(*) as requests_total,
    COUNT(r.id) as receipts_total,
    COUNT(*) FILTER (WHERE r.quality_status = 'ok') as ok_count
  FROM pickup_requests pr
  LEFT JOIN receipts r ON pr.id = r.request_id
  WHERE pr.fulfillment_mode = 'drop_point'
    AND pr.created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY pr.drop_point_id
),
dp_flags AS (
  SELECT 
    pr.drop_point_id,
    unnest(r.contamination_flags) as flag
  FROM receipts r
  JOIN pickup_requests pr ON r.request_id = pr.id
  WHERE pr.fulfillment_mode = 'drop_point'
    AND r.created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND r.contamination_flags IS NOT NULL
),
dp_top_flags AS (
  SELECT 
    drop_point_id,
    array_agg(flag) as flags_list
  FROM (
    SELECT drop_point_id, flag, COUNT(*) as cnt
    FROM dp_flags
    GROUP BY drop_point_id, flag
    ORDER BY drop_point_id, cnt DESC
    LIMIT 3
  ) s
  GROUP BY drop_point_id
)
SELECT 
  dp.id as drop_point_id,
  dp.name,
  COALESCE(ds.requests_total, 0) as requests_total,
  COALESCE(ds.receipts_total, 0) as receipts_total,
  CASE WHEN COALESCE(ds.receipts_total, 0) > 0 THEN ds.ok_count::float / ds.receipts_total ELSE 0 END as ok_rate,
  COALESCE(dtf.flags_list, ARRAY[]::text[]) as top_flags,
  CASE 
    WHEN COALESCE(ds.requests_total, 0) > 50 THEN 'critical' -- Arbitrary threshold for v0
    WHEN COALESCE(ds.requests_total, 0) > 30 THEN 'warning'
    ELSE 'ok'
  END as status_bucket
FROM eco_drop_points dp
LEFT JOIN dp_stats ds ON dp.id = ds.drop_point_id
LEFT JOIN dp_top_flags dtf ON dp.id = dtf.drop_point_id;

-- D) View: v_neighborhood_ops_summary_7d
CREATE OR REPLACE VIEW v_neighborhood_ops_summary_7d AS
SELECT 
  n.id as neighborhood_id,
  n.name as neighborhood_name,
  COUNT(pr.id) as total_requests,
  COUNT(r.id) as total_receipts,
  CASE WHEN COUNT(r.id) > 0 THEN COUNT(*) FILTER (WHERE r.quality_status = 'ok')::float / COUNT(r.id) ELSE 0 END as ok_rate,
  (
    SELECT array_agg(f) FROM (
      SELECT unnest(rx.contamination_flags) as f, COUNT(*) as cnt
      FROM receipts rx
      JOIN pickup_requests prx ON rx.request_id = prx.id
      WHERE prx.neighborhood_id = n.id AND rx.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY f ORDER BY cnt DESC LIMIT 3
    ) s
  ) as top_flags,
  (
    SELECT route_window_id FROM (
      SELECT prx.route_window_id, COUNT(*) as cnt
      FROM pickup_requests prx
      WHERE prx.neighborhood_id = n.id AND prx.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND prx.route_window_id IS NOT NULL
      GROUP BY prx.route_window_id ORDER BY cnt DESC LIMIT 1
    ) s2
  ) as busiest_window_id,
  (
    SELECT format_window_label_lite(rw.weekday, rw.start_time, rw.end_time)
    FROM route_windows rw
    WHERE rw.id = (
      SELECT prx.route_window_id FROM (
        SELECT prx.route_window_id, COUNT(*) as cnt
        FROM pickup_requests prx
        WHERE prx.neighborhood_id = n.id AND prx.created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND prx.route_window_id IS NOT NULL
        GROUP BY prx.route_window_id ORDER BY cnt DESC LIMIT 1
      ) s2b
    )
  ) as busiest_window_label,
  (
    SELECT dpid FROM (
      SELECT prx.drop_point_id as dpid, COUNT(*) as cnt
      FROM pickup_requests prx
      WHERE prx.neighborhood_id = n.id AND prx.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND prx.drop_point_id IS NOT NULL
      GROUP BY dpid ORDER BY cnt DESC LIMIT 1
    ) s3
  ) as busiest_drop_point_id,
  (
    SELECT dp.name
    FROM eco_drop_points dp
    WHERE dp.id = (
      SELECT dpid FROM (
        SELECT prx.drop_point_id as dpid, COUNT(*) as cnt
        FROM pickup_requests prx
        WHERE prx.neighborhood_id = n.id AND prx.created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND prx.drop_point_id IS NOT NULL
        GROUP BY dpid ORDER BY cnt DESC LIMIT 1
      ) s3b
    )
  ) as busiest_drop_point_name,
  (
    SELECT COUNT(*)::float / GREATEST(COUNT(pr.id), 1)
    FROM recurring_subscriptions rs
    WHERE rs.neighborhood_id = n.id AND rs.status = 'active'
  ) as recurring_coverage_pct
FROM neighborhoods n
LEFT JOIN pickup_requests pr ON pr.neighborhood_id = n.id AND pr.created_at >= CURRENT_DATE - INTERVAL '7 days'
LEFT JOIN receipts r ON pr.id = r.request_id
GROUP BY n.id, n.name;

-- Standard RLS for views
GRANT SELECT ON v_window_load_7d TO authenticated;
GRANT SELECT ON v_window_quality_7d TO authenticated;
GRANT SELECT ON v_drop_point_load_7d TO authenticated;
GRANT SELECT ON v_neighborhood_ops_summary_7d TO authenticated;
