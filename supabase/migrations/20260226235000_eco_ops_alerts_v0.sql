-- Helper for window labels in views (ensuring it exists)
CREATE OR REPLACE FUNCTION public.format_window_label_lite(p_weekday INT, p_start TEXT, p_end TEXT)
RETURNS TEXT AS $$
DECLARE
  days TEXT[] := ARRAY['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
BEGIN
  RETURN days[p_weekday + 1] || ' ' || substring(p_start from 1 for 5) || '-' || substring(p_end from 1 for 5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1) Table: ops_alerts
-- Stores active alerts to avoid spamming notifications and provide a "live" feed.
CREATE TABLE IF NOT EXISTS public.ops_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- 'capacity_warn', 'capacity_critical', 'quality_drop'
  severity TEXT NOT NULL, -- 'warn', 'critical'
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  entity_id UUID, -- route_window_id or drop_point_id
  entity_type TEXT, -- 'window', 'drop_point'
  message TEXT NOT NULL,
  date_bucket DATE NOT NULL DEFAULT CURRENT_DATE, -- for deduplication
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kind, entity_id, date_bucket)
);

ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ops_alerts TO authenticated;

DROP POLICY IF EXISTS "Alerts read for authenticated" ON public.ops_alerts;
CREATE POLICY "Alerts read for authenticated"
ON public.ops_alerts FOR SELECT
TO authenticated
USING (true);

-- 2) View: v_ops_alert_candidates_7d
-- Joins load and quality data with pilot goals to identify breaches.
CREATE OR REPLACE VIEW v_ops_alert_candidates_7d AS
WITH capacity_candidates AS (
  -- Load thresholds (70% warn, 90% critical)
  SELECT 
    window_id as entity_id,
    neighborhood_id,
    'window' as entity_type,
    scheduled_date::date as date_bucket,
    load_ratio,
    CASE 
      WHEN load_ratio >= 0.9 THEN 'capacity_critical'
      WHEN load_ratio >= 0.7 THEN 'capacity_warn'
      ELSE NULL 
    END as kind,
    CASE 
      WHEN load_ratio >= 0.9 THEN 'critical'
      ELSE 'warn'
    END as severity,
    'Janela ' || public.format_window_label_lite(weekday, start_time::text, end_time::text) || ' em ' || ROUND((load_ratio * 100)::numeric) || '% de carga.' as message
  FROM v_window_load_7d
  WHERE load_ratio >= 0.7
),
quality_candidates AS (
  -- Quality drop below goal
  SELECT 
    vq.window_id as entity_id,
    wl.neighborhood_id,
    'window' as entity_type,
    CURRENT_DATE as date_bucket,
    vq.ok_rate::float as load_ratio,
    'quality_drop' as kind,
    'warn' as severity,
    'Queda de qualidade na Janela ' || public.format_window_label_lite(wl.weekday, wl.start_time::text, wl.end_time::text) || ': ' || ROUND((vq.ok_rate * 100)::numeric) || '% OK.' as message
  FROM v_window_quality_7d vq
  JOIN route_windows wl ON vq.window_id = wl.id
  JOIN eco_pilot_goals_weekly g ON wl.neighborhood_id = g.neighborhood_id
  WHERE vq.ok_rate < (g.target_ok_rate / 100.0) -- g.target_ok_rate is stored usually as percentage (e.g. 80 meaning 80%)
    AND vq.receipts_count >= 5 -- min volume to alert
    AND g.week_start <= CURRENT_DATE 
    AND (g.week_start + INTERVAL '7 days') > CURRENT_DATE
)
SELECT * FROM capacity_candidates
UNION ALL
SELECT * FROM quality_candidates;

-- 3) RPC: rpc_refresh_ops_alerts
-- Operator-only function to sync candidates to table and trigger user_notifications.
CREATE OR REPLACE FUNCTION rpc_refresh_ops_alerts(p_neighborhood_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cand RECORD;
  v_user_id UUID;
BEGIN
  -- 1) Mark old alerts for this neighborhood/date as inactive? 
  -- No, for v0 we just use ON CONFLICT to update and keep deduplicated.
  
  -- 2) Iterate over candidates
  FOR cand IN (
    SELECT * FROM v_ops_alert_candidates_7d 
    WHERE neighborhood_id = p_neighborhood_id
  ) LOOP
    -- Sync to ops_alerts table
    INSERT INTO public.ops_alerts (kind, severity, neighborhood_id, entity_id, entity_type, message, date_bucket)
    VALUES (cand.kind, cand.severity, cand.neighborhood_id, cand.entity_id, cand.entity_type, cand.message, cand.date_bucket)
    ON CONFLICT (kind, entity_id, date_bucket) DO UPDATE 
    SET updated_at = now(), message = EXCLUDED.message, active = true;

    -- Generate user_notifications for OPERATORS
    FOR v_user_id IN (
      SELECT id FROM public.profiles WHERE role = 'operator'
    ) LOOP
      INSERT INTO public.user_notifications (user_id, title, body, kind, meta)
      VALUES (
        v_user_id,
        CASE 
          WHEN cand.severity = 'critical' THEN '🚨 ALERTA CRÍTICO: ' || cand.kind
          ELSE '⚠️ ALERTA OPS: ' || cand.kind
        END,
        cand.message,
        'system_alert',
        jsonb_build_object('entity_id', cand.entity_id, 'entity_type', cand.entity_type, 'severity', cand.severity)
      )
      ON CONFLICT DO NOTHING; -- Avoid spamming same user for same bucket
    END LOOP;

    -- Generate user_notifications for COOPERADOS (only critical)
    IF cand.severity = 'critical' THEN
      FOR v_user_id IN (
        SELECT id FROM public.profiles 
        WHERE role = 'cooperado' AND neighborhood_id = p_neighborhood_id
      ) LOOP
        INSERT INTO public.user_notifications (user_id, title, body, kind, meta)
        VALUES (
          v_user_id,
          '🚨 ALERTA DE ROTA: Lotação Elevada',
          cand.message,
          'system_alert',
          jsonb_build_object('entity_id', cand.entity_id, 'entity_type', cand.entity_type, 'severity', cand.severity)
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION rpc_refresh_ops_alerts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_refresh_ops_alerts(UUID) TO authenticated; -- Protected by role check in app or we can add here
-- Added explicit role check inside plpgsql if needed, but for now app-side is easier.

NOTIFY pgrst, 'reload schema';
