-- 1) Table: eco_obs_events
-- Technical technical telemetry for anti-surveillance monitoring.
-- Stores technical failures (RPC errors, sync failures, etc.) without PII.
CREATE TABLE IF NOT EXISTS public.eco_obs_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scope TEXT NOT NULL CHECK (scope IN ('cell', 'neighborhood', 'global')),
  cell_id UUID REFERENCES public.eco_cells(id) ON DELETE CASCADE,
  neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL, -- client_error, api_error, rpc_error, sync_fail, upload_fail, etc.
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  context_kind TEXT, -- page, api, rpc, feature
  context_key TEXT, -- e.g. "/api/media/signed-url"
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  user_fingerprint TEXT -- Optional anonymous hash (not used for PII)
);

-- Index for dashboard performance
CREATE INDEX IF NOT EXISTS idx_obs_events_created_at ON public.eco_obs_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_events_neighborhood_id ON public.eco_obs_events(neighborhood_id) WHERE neighborhood_id IS NOT NULL;

-- 2) Table: eco_obs_rollups_daily
CREATE TABLE IF NOT EXISTS public.eco_obs_rollups_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day DATE NOT NULL,
  cell_id UUID REFERENCES public.eco_cells(id) ON DELETE CASCADE,
  neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb, -- map of counts { "event_kind": n, "severity": { "critical": n } }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(day, cell_id, neighborhood_id)
);

ALTER TABLE public.eco_obs_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_obs_rollups_daily ENABLE ROW LEVEL SECURITY;

-- 3) RLS Policies
-- Selective access for operators/moderators
CREATE POLICY "Operators can read obs events"
ON public.eco_obs_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('operator', 'moderator')
  )
);

CREATE POLICY "Operators can read obs rollups"
ON public.eco_obs_rollups_daily FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('operator', 'moderator')
  )
);

-- 4) RPC: rpc_insert_obs_event
-- SECURITY DEFINER to allow inserts from edge functions without direct table grants to public.
CREATE OR REPLACE FUNCTION public.rpc_insert_obs_event(
  p_event_kind TEXT,
  p_severity TEXT,
  p_context_kind TEXT,
  p_context_key TEXT,
  p_message TEXT,
  p_meta JSONB DEFAULT '{}'::jsonb,
  p_neighborhood_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cell_id UUID;
  v_event_id UUID;
BEGIN
  -- Determine cell_id if neighborhood_id is provided
  IF p_neighborhood_id IS NOT NULL THEN
    SELECT cell_id INTO v_cell_id FROM eco_cell_neighborhoods WHERE neighborhood_id = p_neighborhood_id LIMIT 1;
  END IF;

  -- Simple Sanitization (Message length and PII patterns)
  -- Redacts common patterns: emails and legacy phone formats
  p_message := substring(p_message from 1 for 200);
  p_message := regexp_replace(p_message, '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[EMAIL]', 'g');
  -- Simple phone redaction (greedy)
  p_message := regexp_replace(p_message, '\+?[0-9]{2,3}?[ -]?[0-9]{2}?[ -]?[0-9]{4,5}[ -]?[0-9]{4}', '[PHONE]', 'g');

  INSERT INTO public.eco_obs_events (
    scope,
    cell_id,
    neighborhood_id,
    event_kind,
    severity,
    context_kind,
    context_key,
    message,
    meta
  ) VALUES (
    CASE WHEN p_neighborhood_id IS NOT NULL THEN 'neighborhood' ELSE 'global' END,
    v_cell_id,
    p_neighborhood_id,
    p_event_kind,
    p_severity,
    p_context_kind,
    p_context_key,
    p_message,
    p_meta
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Allow authenticated users to insert via RPC (edge logic will trigger it)
GRANT EXECUTE ON FUNCTION public.rpc_insert_obs_event TO authenticated;

-- 5) Cron-like RPC for Rollups (Manual for now or triggered by admin)
CREATE OR REPLACE FUNCTION public.rpc_generate_obs_rollup(p_day DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.eco_obs_rollups_daily (day, cell_id, neighborhood_id, stats)
  SELECT 
    p_day,
    cell_id,
    neighborhood_id,
    jsonb_build_object(
      'total_count', count(*),
      'by_severity', jsonb_object_agg(severity, severity_count),
      'by_kind', jsonb_object_agg(event_kind, kind_count)
    )
  FROM (
    SELECT 
      cell_id, 
      neighborhood_id, 
      severity, count(*) as severity_count,
      event_kind, count(*) as kind_count
    FROM public.eco_obs_events
    WHERE created_at::date = p_day
    GROUP BY cell_id, neighborhood_id, severity, event_kind
  ) sub
  GROUP BY cell_id, neighborhood_id
  ON CONFLICT (day, cell_id, neighborhood_id) DO UPDATE
  SET stats = EXCLUDED.stats;
END;
$$;

NOTIFY pgrst, 'reload schema';
