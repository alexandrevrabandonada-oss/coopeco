-- A9 refresh: Pilot Pack VR (config + ritual do dia + boletim semanal sanitizado)

CREATE TABLE IF NOT EXISTS public.eco_pilot_configs (
  neighborhood_id UUID PRIMARY KEY REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT false,
  pilot_name TEXT NOT NULL DEFAULT 'Bairro Piloto',
  intro_md TEXT,
  weekly_bulletin_weekday INT NOT NULL DEFAULT 1 CHECK (weekly_bulletin_weekday BETWEEN 0 AND 6),
  weekly_bulletin_hour INT NOT NULL DEFAULT 18 CHECK (weekly_bulletin_hour BETWEEN 0 AND 23),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eco_pilot_goals_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  target_receipts INT NOT NULL DEFAULT 50 CHECK (target_receipts >= 0),
  target_ok_rate NUMERIC(5,2) NOT NULL DEFAULT 80.00 CHECK (target_ok_rate >= 0 AND target_ok_rate <= 100),
  target_recurring_coverage_pct NUMERIC(5,2) NOT NULL DEFAULT 40.00 CHECK (target_recurring_coverage_pct >= 0 AND target_recurring_coverage_pct <= 100),
  target_drop_point_share_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00 CHECK (target_drop_point_share_pct >= 0 AND target_drop_point_share_pct <= 100),
  target_anchor_partners INT NOT NULL DEFAULT 2 CHECK (target_anchor_partners >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (neighborhood_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.eco_ops_day_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  op_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (neighborhood_id, op_date)
);

CREATE TABLE IF NOT EXISTS public.eco_ops_day_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.eco_ops_day_runs(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL CHECK (task_key IN ('generate_recurring', 'open_lot', 'assign_receipts', 'close_lot', 'publish_bulletin')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'skipped')),
  meta JSONB,
  completed_at TIMESTAMPTZ,
  UNIQUE (run_id, task_key)
);

CREATE TABLE IF NOT EXISTS public.eco_weekly_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  highlights JSONB,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (neighborhood_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_eco_ops_day_runs_neighborhood_date
  ON public.eco_ops_day_runs (neighborhood_id, op_date DESC);

CREATE INDEX IF NOT EXISTS idx_eco_ops_day_tasks_run
  ON public.eco_ops_day_tasks (run_id, task_key);

CREATE INDEX IF NOT EXISTS idx_eco_weekly_bulletins_neighborhood_week
  ON public.eco_weekly_bulletins (neighborhood_id, week_start DESC);

DROP TRIGGER IF EXISTS tr_eco_pilot_configs_updated_at ON public.eco_pilot_configs;
CREATE TRIGGER tr_eco_pilot_configs_updated_at
BEFORE UPDATE ON public.eco_pilot_configs
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

DROP TRIGGER IF EXISTS tr_eco_ops_day_runs_updated_at ON public.eco_ops_day_runs;
CREATE TRIGGER tr_eco_ops_day_runs_updated_at
BEFORE UPDATE ON public.eco_ops_day_runs
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

ALTER TABLE public.eco_pilot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_pilot_goals_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_ops_day_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_ops_day_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_weekly_bulletins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage eco pilot configs" ON public.eco_pilot_configs;
CREATE POLICY "Operators manage eco pilot configs"
ON public.eco_pilot_configs
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators manage eco pilot goals weekly" ON public.eco_pilot_goals_weekly;
CREATE POLICY "Operators manage eco pilot goals weekly"
ON public.eco_pilot_goals_weekly
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators manage eco ops day runs" ON public.eco_ops_day_runs;
CREATE POLICY "Operators manage eco ops day runs"
ON public.eco_ops_day_runs
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators manage eco ops day tasks" ON public.eco_ops_day_tasks;
CREATE POLICY "Operators manage eco ops day tasks"
ON public.eco_ops_day_tasks
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators manage eco weekly bulletins" ON public.eco_weekly_bulletins;
CREATE POLICY "Operators manage eco weekly bulletins"
ON public.eco_weekly_bulletins
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Public reads published eco weekly bulletins" ON public.eco_weekly_bulletins;
CREATE POLICY "Public reads published eco weekly bulletins"
ON public.eco_weekly_bulletins
FOR SELECT
USING (is_published = true);

CREATE OR REPLACE VIEW public.v_pilot_public_config AS
SELECT
  neighborhood_id,
  pilot_name,
  intro_md,
  active
FROM public.eco_pilot_configs
WHERE active = true;

GRANT SELECT ON public.v_pilot_public_config TO anon, authenticated;

CREATE OR REPLACE VIEW public.v_neighborhood_weekly_snapshot AS
WITH week_ref AS (
  SELECT date_trunc('week', now())::date AS week_start
),
request_stats AS (
  SELECT
    pr.neighborhood_id,
    COUNT(*)::INT AS requests_count_week,
    COUNT(*) FILTER (WHERE pr.is_recurring = true)::INT AS recurring_count_week,
    COUNT(*) FILTER (WHERE COALESCE(pr.fulfillment_mode, 'doorstep') = 'drop_point')::INT AS drop_point_count_week
  FROM public.pickup_requests pr
  JOIN week_ref w ON COALESCE(pr.scheduled_for::date, pr.created_at::date) >= w.week_start
    AND COALESCE(pr.scheduled_for::date, pr.created_at::date) < (w.week_start + 7)
  GROUP BY pr.neighborhood_id
),
receipt_stats AS (
  SELECT
    pr.neighborhood_id,
    COUNT(r.id)::INT AS receipts_count_week,
    ROUND((COUNT(*) FILTER (WHERE COALESCE(r.quality_status, 'ok') = 'ok')::numeric / NULLIF(COUNT(r.id), 0)::numeric) * 100, 2) AS ok_rate_week
  FROM public.receipts r
  JOIN public.pickup_requests pr ON pr.id = r.request_id
  JOIN week_ref w ON r.created_at::date >= w.week_start
    AND r.created_at::date < (w.week_start + 7)
  GROUP BY pr.neighborhood_id
),
flags AS (
  SELECT
    pr.neighborhood_id,
    flag_name,
    COUNT(*) AS c
  FROM public.receipts r
  JOIN public.pickup_requests pr ON pr.id = r.request_id
  JOIN week_ref w ON r.created_at::date >= w.week_start
    AND r.created_at::date < (w.week_start + 7)
  CROSS JOIN LATERAL unnest(COALESCE(r.contamination_flags, ARRAY[]::TEXT[])) AS flag_name
  WHERE flag_name IS NOT NULL AND flag_name <> ''
  GROUP BY pr.neighborhood_id, flag_name
),
top_flags AS (
  SELECT
    f.neighborhood_id,
    string_agg(f.flag_name, ', ' ORDER BY f.c DESC, f.flag_name) AS top_flags_week
  FROM (
    SELECT
      neighborhood_id,
      flag_name,
      c,
      row_number() OVER (PARTITION BY neighborhood_id ORDER BY c DESC, flag_name) AS rn
    FROM flags
  ) f
  WHERE f.rn <= 3
  GROUP BY f.neighborhood_id
),
lots_stats AS (
  SELECT
    neighborhood_id,
    COUNT(*)::INT AS lots_closed_week
  FROM public.v_lot_transparency_sanitized v
  JOIN week_ref w ON v.lot_date >= w.week_start
    AND v.lot_date < (w.week_start + 7)
  GROUP BY neighborhood_id
),
anchors_stats AS (
  SELECT
    p.neighborhood_id,
    COUNT(*) FILTER (WHERE ac.status = 'active')::INT AS anchors_active_count
  FROM public.anchor_commitments ac
  JOIN public.partners p ON p.id = ac.partner_id
  GROUP BY p.neighborhood_id
)
SELECT
  n.id AS neighborhood_id,
  w.week_start,
  COALESCE(rs.requests_count_week, 0) AS requests_count_week,
  COALESCE(rc.receipts_count_week, 0) AS receipts_count_week,
  COALESCE(rc.ok_rate_week, 0)::NUMERIC(5,2) AS ok_rate_week,
  CASE
    WHEN COALESCE(rs.requests_count_week, 0) = 0 THEN 0::NUMERIC(5,2)
    ELSE ROUND((rs.recurring_count_week::numeric / rs.requests_count_week::numeric) * 100, 2)
  END AS recurring_coverage_pct_week,
  CASE
    WHEN COALESCE(rs.requests_count_week, 0) = 0 THEN 0::NUMERIC(5,2)
    ELSE ROUND((rs.drop_point_count_week::numeric / rs.requests_count_week::numeric) * 100, 2)
  END AS drop_point_share_pct_week,
  COALESCE(tf.top_flags_week, '') AS top_flags_week,
  COALESCE(ls.lots_closed_week, 0) AS lots_closed_week,
  COALESCE(asx.anchors_active_count, 0) AS anchors_active_count
FROM public.neighborhoods n
CROSS JOIN week_ref w
LEFT JOIN request_stats rs ON rs.neighborhood_id = n.id
LEFT JOIN receipt_stats rc ON rc.neighborhood_id = n.id
LEFT JOIN top_flags tf ON tf.neighborhood_id = n.id
LEFT JOIN lots_stats ls ON ls.neighborhood_id = n.id
LEFT JOIN anchors_stats asx ON asx.neighborhood_id = n.id;

GRANT SELECT ON public.v_neighborhood_weekly_snapshot TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.eco_pilot_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_actor UUID;
  v_target_text TEXT;
  v_target_id UUID;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'eco_pilot_configs' THEN
    v_action := 'pilot_config_changed';
  ELSIF TG_TABLE_NAME = 'eco_pilot_goals_weekly' THEN
    v_action := 'pilot_goal_set';
  ELSIF TG_TABLE_NAME = 'eco_ops_day_runs' THEN
    v_action := 'ops_day_started';
  ELSIF TG_TABLE_NAME = 'eco_ops_day_tasks' THEN
    v_action := 'ops_task_done';
  ELSIF TG_TABLE_NAME = 'eco_weekly_bulletins' THEN
    IF COALESCE((to_jsonb(NEW)->>'is_published')::boolean, false) THEN
      v_action := 'weekly_bulletin_published';
    ELSE
      v_action := 'weekly_bulletin_saved';
    END IF;
  ELSE
    v_action := 'pilot_pack_changed';
  END IF;

  v_target_text := COALESCE(
    to_jsonb(NEW)->>'id',
    to_jsonb(NEW)->>'neighborhood_id',
    to_jsonb(OLD)->>'id',
    to_jsonb(OLD)->>'neighborhood_id'
  );

  BEGIN
    IF v_target_text IS NOT NULL THEN
      v_target_id := v_target_text::uuid;
    END IF;
  EXCEPTION WHEN others THEN
    v_target_id := NULL;
  END;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, meta)
  VALUES (
    v_actor,
    v_action,
    'system',
    v_target_id,
    jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_eco_pilot_configs_audit ON public.eco_pilot_configs;
CREATE TRIGGER tr_eco_pilot_configs_audit
AFTER INSERT OR UPDATE ON public.eco_pilot_configs
FOR EACH ROW
EXECUTE FUNCTION public.eco_pilot_audit_log();

DROP TRIGGER IF EXISTS tr_eco_pilot_goals_weekly_audit ON public.eco_pilot_goals_weekly;
CREATE TRIGGER tr_eco_pilot_goals_weekly_audit
AFTER INSERT OR UPDATE ON public.eco_pilot_goals_weekly
FOR EACH ROW
EXECUTE FUNCTION public.eco_pilot_audit_log();

DROP TRIGGER IF EXISTS tr_eco_ops_day_runs_audit ON public.eco_ops_day_runs;
CREATE TRIGGER tr_eco_ops_day_runs_audit
AFTER INSERT OR UPDATE ON public.eco_ops_day_runs
FOR EACH ROW
EXECUTE FUNCTION public.eco_pilot_audit_log();

DROP TRIGGER IF EXISTS tr_eco_ops_day_tasks_audit ON public.eco_ops_day_tasks;
CREATE TRIGGER tr_eco_ops_day_tasks_audit
AFTER INSERT OR UPDATE ON public.eco_ops_day_tasks
FOR EACH ROW
EXECUTE FUNCTION public.eco_pilot_audit_log();

DROP TRIGGER IF EXISTS tr_eco_weekly_bulletins_audit ON public.eco_weekly_bulletins;
CREATE TRIGGER tr_eco_weekly_bulletins_audit
AFTER INSERT OR UPDATE ON public.eco_weekly_bulletins
FOR EACH ROW
EXECUTE FUNCTION public.eco_pilot_audit_log();

NOTIFY pgrst, 'reload schema';
