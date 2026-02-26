-- A10: Galpao v0 (lote do dia + triagem + fechamento sanitizado)

CREATE TABLE IF NOT EXISTS public.lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  lot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  title TEXT NOT NULL DEFAULT 'Lote do dia',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  closed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lots_neighborhood_date_status
  ON public.lots (neighborhood_id, lot_date DESC, status);

CREATE TABLE IF NOT EXISTS public.lot_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  receipt_id UUID NOT NULL UNIQUE REFERENCES public.receipts(id) ON DELETE CASCADE,
  triage_status TEXT NOT NULL DEFAULT 'ok' CHECK (triage_status IN ('ok', 'misto', 'contaminado', 'rejeito', 'perigoso')),
  triage_flag TEXT,
  triage_notes TEXT,
  triaged_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lot_receipts_lot_created
  ON public.lot_receipts (lot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lot_triage_summary (
  lot_id UUID PRIMARY KEY REFERENCES public.lots(id) ON DELETE CASCADE,
  receipts_count INT NOT NULL DEFAULT 0,
  ok_count INT NOT NULL DEFAULT 0,
  misto_count INT NOT NULL DEFAULT 0,
  contaminado_count INT NOT NULL DEFAULT 0,
  rejeito_count INT NOT NULL DEFAULT 0,
  perigoso_count INT NOT NULL DEFAULT 0,
  dominant_flag TEXT,
  education_highlight TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tr_lots_updated_at ON public.lots;
CREATE TRIGGER tr_lots_updated_at
BEFORE UPDATE ON public.lots
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

DROP TRIGGER IF EXISTS tr_lot_receipts_updated_at ON public.lot_receipts;
CREATE TRIGGER tr_lot_receipts_updated_at
BEFORE UPDATE ON public.lot_receipts
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

CREATE OR REPLACE FUNCTION public.eco_refresh_lot_triage_summary(p_lot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipts_count INT := 0;
  v_ok_count INT := 0;
  v_misto_count INT := 0;
  v_contaminado_count INT := 0;
  v_rejeito_count INT := 0;
  v_perigoso_count INT := 0;
  v_dominant_flag TEXT := NULL;
  v_education_highlight TEXT := NULL;
BEGIN
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE lr.triage_status = 'ok')::INT,
    COUNT(*) FILTER (WHERE lr.triage_status = 'misto')::INT,
    COUNT(*) FILTER (WHERE lr.triage_status = 'contaminado')::INT,
    COUNT(*) FILTER (WHERE lr.triage_status = 'rejeito')::INT,
    COUNT(*) FILTER (WHERE lr.triage_status = 'perigoso')::INT
  INTO
    v_receipts_count,
    v_ok_count,
    v_misto_count,
    v_contaminado_count,
    v_rejeito_count,
    v_perigoso_count
  FROM public.lot_receipts lr
  WHERE lr.lot_id = p_lot_id;

  SELECT sub.flag_name
  INTO v_dominant_flag
  FROM (
    SELECT flag_name, COUNT(*) AS c
    FROM (
      SELECT unnest(COALESCE(r.contamination_flags, ARRAY[]::TEXT[])) AS flag_name
      FROM public.lot_receipts lr
      JOIN public.receipts r ON r.id = lr.receipt_id
      WHERE lr.lot_id = p_lot_id
    ) f
    WHERE flag_name IS NOT NULL AND flag_name <> ''
    GROUP BY flag_name
    ORDER BY c DESC, flag_name
    LIMIT 1
  ) sub;

  IF v_dominant_flag IN ('food', 'liquids') THEN
    v_education_highlight := 'Dica da semana: reforcar separacao limpa e seca para reduzir contaminacao por alimento/liquido.';
  END IF;

  INSERT INTO public.lot_triage_summary (
    lot_id,
    receipts_count,
    ok_count,
    misto_count,
    contaminado_count,
    rejeito_count,
    perigoso_count,
    dominant_flag,
    education_highlight,
    updated_at
  )
  VALUES (
    p_lot_id,
    v_receipts_count,
    v_ok_count,
    v_misto_count,
    v_contaminado_count,
    v_rejeito_count,
    v_perigoso_count,
    v_dominant_flag,
    v_education_highlight,
    now()
  )
  ON CONFLICT (lot_id) DO UPDATE
  SET
    receipts_count = EXCLUDED.receipts_count,
    ok_count = EXCLUDED.ok_count,
    misto_count = EXCLUDED.misto_count,
    contaminado_count = EXCLUDED.contaminado_count,
    rejeito_count = EXCLUDED.rejeito_count,
    perigoso_count = EXCLUDED.perigoso_count,
    dominant_flag = EXCLUDED.dominant_flag,
    education_highlight = EXCLUDED.education_highlight,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.eco_refresh_lot_triage_summary_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot_id UUID;
BEGIN
  v_lot_id := COALESCE(NEW.lot_id, OLD.lot_id);
  PERFORM public.eco_refresh_lot_triage_summary(v_lot_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_lot_receipts_refresh_summary_insert ON public.lot_receipts;
CREATE TRIGGER tr_lot_receipts_refresh_summary_insert
AFTER INSERT ON public.lot_receipts
FOR EACH ROW
EXECUTE FUNCTION public.eco_refresh_lot_triage_summary_trigger();

DROP TRIGGER IF EXISTS tr_lot_receipts_refresh_summary_update ON public.lot_receipts;
CREATE TRIGGER tr_lot_receipts_refresh_summary_update
AFTER UPDATE ON public.lot_receipts
FOR EACH ROW
EXECUTE FUNCTION public.eco_refresh_lot_triage_summary_trigger();

DROP TRIGGER IF EXISTS tr_lot_receipts_refresh_summary_delete ON public.lot_receipts;
CREATE TRIGGER tr_lot_receipts_refresh_summary_delete
AFTER DELETE ON public.lot_receipts
FOR EACH ROW
EXECUTE FUNCTION public.eco_refresh_lot_triage_summary_trigger();

CREATE OR REPLACE FUNCTION public.rpc_refresh_lot_triage_summary(p_lot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(ARRAY['operator'::public.app_role, 'cooperado'::public.app_role]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM public.eco_refresh_lot_triage_summary(p_lot_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_refresh_lot_triage_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_refresh_lot_triage_summary(UUID) TO authenticated;

ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_triage_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage lots" ON public.lots;
CREATE POLICY "Operators manage lots"
ON public.lots
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Cooperado read lots from own neighborhood" ON public.lots;
CREATE POLICY "Cooperado read lots from own neighborhood"
ON public.lots
FOR SELECT
TO authenticated
USING (
  public.has_role(ARRAY['cooperado'::public.app_role, 'operator'::public.app_role])
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.neighborhood_id = lots.neighborhood_id
  )
);

DROP POLICY IF EXISTS "Cooperado and operator manage lot receipts" ON public.lot_receipts;
CREATE POLICY "Cooperado and operator manage lot receipts"
ON public.lot_receipts
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['cooperado'::public.app_role, 'operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['cooperado'::public.app_role, 'operator'::public.app_role]));

DROP POLICY IF EXISTS "Authenticated read lot summaries" ON public.lot_triage_summary;
CREATE POLICY "Authenticated read lot summaries"
ON public.lot_triage_summary
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Operators update lot summaries" ON public.lot_triage_summary;
CREATE POLICY "Operators update lot summaries"
ON public.lot_triage_summary
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

CREATE OR REPLACE VIEW public.v_lot_transparency_sanitized AS
SELECT
  l.id AS lot_id,
  l.neighborhood_id,
  n.slug,
  n.name AS neighborhood_name,
  l.lot_date,
  l.status,
  l.closed_at,
  COALESCE(s.receipts_count, 0) AS receipts_count,
  COALESCE(s.ok_count, 0) AS ok_count,
  COALESCE(s.misto_count, 0) AS misto_count,
  COALESCE(s.contaminado_count, 0) AS contaminado_count,
  COALESCE(s.rejeito_count, 0) AS rejeito_count,
  COALESCE(s.perigoso_count, 0) AS perigoso_count,
  s.dominant_flag,
  s.education_highlight
FROM public.lots l
JOIN public.neighborhoods n ON n.id = l.neighborhood_id
LEFT JOIN public.lot_triage_summary s ON s.lot_id = l.id
WHERE l.status = 'closed';

GRANT SELECT ON public.v_lot_transparency_sanitized TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
