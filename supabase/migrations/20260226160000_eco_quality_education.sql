-- A8: Qualidade + Educacao (Aula por Recibo) + Ranking por qualidade/recorrencia

ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'ok' CHECK (quality_status IN ('ok', 'attention', 'contaminated')),
  ADD COLUMN IF NOT EXISTS quality_notes TEXT,
  ADD COLUMN IF NOT EXISTS contamination_flags TEXT[];

CREATE TABLE IF NOT EXISTS public.edu_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 280 AND 500),
  material public.material_kind,
  flag TEXT,
  locale TEXT NOT NULL DEFAULT 'vr',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receipt_tip (
  receipt_id UUID PRIMARY KEY REFERENCES public.receipts(id) ON DELETE CASCADE,
  tip_id UUID NOT NULL REFERENCES public.edu_tips(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.edu_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_tip ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Edu tips public read" ON public.edu_tips;
CREATE POLICY "Edu tips public read"
ON public.edu_tips
FOR SELECT
TO PUBLIC
USING (active = true);

DROP POLICY IF EXISTS "Operators manage edu tips" ON public.edu_tips;
CREATE POLICY "Operators manage edu tips"
ON public.edu_tips
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Receipt tip read owner coop operator" ON public.receipt_tip;
CREATE POLICY "Receipt tip read owner coop operator"
ON public.receipt_tip
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.receipts r
    JOIN public.pickup_requests pr ON pr.id = r.request_id
    WHERE r.id = receipt_id
      AND (
        pr.created_by = auth.uid()
        OR r.cooperado_id = auth.uid()
        OR public.has_role(ARRAY['operator'::public.app_role])
      )
  )
);

DROP POLICY IF EXISTS "Receipt tip insert coop operator" ON public.receipt_tip;
CREATE POLICY "Receipt tip insert coop operator"
ON public.receipt_tip
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.receipts r
    WHERE r.id = receipt_id
      AND (
        r.cooperado_id = auth.uid()
        OR public.has_role(ARRAY['operator'::public.app_role])
      )
  )
);

DROP POLICY IF EXISTS "Receipt tip update operator" ON public.receipt_tip;
CREATE POLICY "Receipt tip update operator"
ON public.receipt_tip
FOR UPDATE
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Receipt tip delete operator" ON public.receipt_tip;
CREATE POLICY "Receipt tip delete operator"
ON public.receipt_tip
FOR DELETE
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]));

ALTER TABLE public.metrics_daily
  ADD COLUMN IF NOT EXISTS quality_ok_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_attention_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_contaminated_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.quality_flags_daily (
  day DATE NOT NULL,
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  flag TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, neighborhood_id, flag)
);

ALTER TABLE public.quality_flags_daily ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.quality_flags_daily TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quality_flags_daily TO authenticated;

DROP POLICY IF EXISTS "Quality flags public read" ON public.quality_flags_daily;
CREATE POLICY "Quality flags public read"
ON public.quality_flags_daily
FOR SELECT
TO PUBLIC
USING (true);

DROP POLICY IF EXISTS "Operators manage quality flags daily" ON public.quality_flags_daily;
CREATE POLICY "Operators manage quality flags daily"
ON public.quality_flags_daily
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

CREATE OR REPLACE FUNCTION public.pick_edu_tip(
  p_material public.material_kind,
  p_flags TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen UUID;
BEGIN
  -- 1) prioridade por flag
  IF p_flags IS NOT NULL AND array_length(p_flags, 1) > 0 THEN
    SELECT t.id INTO chosen
    FROM public.edu_tips t
    WHERE t.active = true
      AND t.flag = ANY(p_flags)
    ORDER BY t.created_at DESC
    LIMIT 1;
  END IF;

  -- 2) fallback por material
  IF chosen IS NULL AND p_material IS NOT NULL THEN
    SELECT t.id INTO chosen
    FROM public.edu_tips t
    WHERE t.active = true
      AND t.material = p_material
      AND t.flag IS NULL
    ORDER BY t.created_at DESC
    LIMIT 1;
  END IF;

  -- 3) fallback generica
  IF chosen IS NULL THEN
    SELECT t.id INTO chosen
    FROM public.edu_tips t
    WHERE t.active = true
      AND t.material IS NULL
      AND t.flag IS NULL
    ORDER BY t.created_at DESC
    LIMIT 1;
  END IF;

  RETURN chosen;
END;
$$;

REVOKE ALL ON FUNCTION public.pick_edu_tip(public.material_kind, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pick_edu_tip(public.material_kind, TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_receipt_tip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_material public.material_kind;
  chosen_tip UUID;
BEGIN
  SELECT i.material
    INTO first_material
  FROM public.pickup_request_items i
  WHERE i.request_id = NEW.request_id
  ORDER BY i.created_at ASC
  LIMIT 1;

  chosen_tip := public.pick_edu_tip(first_material, NEW.contamination_flags);

  IF chosen_tip IS NOT NULL THEN
    INSERT INTO public.receipt_tip (receipt_id, tip_id)
    VALUES (NEW.id, chosen_tip)
    ON CONFLICT (receipt_id) DO UPDATE
      SET tip_id = EXCLUDED.tip_id,
          created_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_assign_receipt_tip ON public.receipts;
CREATE TRIGGER tr_assign_receipt_tip
AFTER INSERT ON public.receipts
FOR EACH ROW
EXECUTE FUNCTION public.assign_receipt_tip();

CREATE OR REPLACE FUNCTION public.proc_handle_impact_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.metrics_daily (
    day, neighborhood_id, partner_id,
    receipts_count, mutiroes_count, chamados_count, impact_score,
    quality_ok_count, quality_attention_count, quality_contaminated_count
  )
  VALUES (
    CURRENT_DATE,
    NEW.neighborhood_id,
    NEW.partner_id,
    CASE WHEN NEW.kind = 'receipt_created' THEN 1 ELSE 0 END,
    CASE WHEN NEW.kind = 'mutirao_created' THEN 1 ELSE 0 END,
    CASE WHEN NEW.kind = 'chamado_created' THEN 1 ELSE 0 END,
    NEW.weight,
    CASE WHEN NEW.kind = 'receipt_created' AND COALESCE(NEW.meta->>'quality_status', 'ok') = 'ok' THEN 1 ELSE 0 END,
    CASE WHEN NEW.kind = 'receipt_created' AND COALESCE(NEW.meta->>'quality_status', 'ok') = 'attention' THEN 1 ELSE 0 END,
    CASE WHEN NEW.kind = 'receipt_created' AND COALESCE(NEW.meta->>'quality_status', 'ok') = 'contaminated' THEN 1 ELSE 0 END
  )
  ON CONFLICT (day, neighborhood_id, COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    receipts_count = metrics_daily.receipts_count + EXCLUDED.receipts_count,
    mutiroes_count = metrics_daily.mutiroes_count + EXCLUDED.mutiroes_count,
    chamados_count = metrics_daily.chamados_count + EXCLUDED.chamados_count,
    impact_score = metrics_daily.impact_score + EXCLUDED.impact_score,
    quality_ok_count = metrics_daily.quality_ok_count + EXCLUDED.quality_ok_count,
    quality_attention_count = metrics_daily.quality_attention_count + EXCLUDED.quality_attention_count,
    quality_contaminated_count = metrics_daily.quality_contaminated_count + EXCLUDED.quality_contaminated_count;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.on_receipt_created_impact()
RETURNS TRIGGER AS $$
DECLARE
  v_neighborhood_id UUID;
  v_partner_id UUID;
  v_quality_multiplier NUMERIC := 1.0;
  v_weight INT := 10;
  v_flags TEXT[] := COALESCE(NEW.contamination_flags, ARRAY[]::TEXT[]);
  v_flag TEXT;
BEGIN
  SELECT neighborhood_id INTO v_neighborhood_id
  FROM public.pickup_requests
  WHERE id = NEW.request_id;

  SELECT partner_id INTO v_partner_id
  FROM public.partner_receipts
  WHERE receipt_id = NEW.id
  LIMIT 1;

  v_quality_multiplier := CASE NEW.quality_status
    WHEN 'ok' THEN 1.0
    WHEN 'attention' THEN 0.7
    WHEN 'contaminated' THEN 0.3
    ELSE 1.0
  END;

  v_weight := GREATEST(1, ROUND(10 * v_quality_multiplier));

  INSERT INTO public.impact_events (kind, neighborhood_id, partner_id, receipt_id, weight, meta)
  VALUES (
    'receipt_created',
    v_neighborhood_id,
    v_partner_id,
    NEW.id,
    v_weight,
    jsonb_build_object(
      'quality_status', NEW.quality_status,
      'is_recurring', EXISTS (
        SELECT 1
        FROM public.pickup_requests pr
        WHERE pr.id = NEW.request_id
          AND COALESCE(pr.is_recurring, false) = true
      ),
      'contamination_flags', v_flags
    )
  );

  IF array_length(v_flags, 1) IS NOT NULL THEN
    FOREACH v_flag IN ARRAY v_flags LOOP
      INSERT INTO public.quality_flags_daily (day, neighborhood_id, flag, count)
      VALUES (CURRENT_DATE, v_neighborhood_id, v_flag, 1)
      ON CONFLICT (day, neighborhood_id, flag)
      DO UPDATE SET count = public.quality_flags_daily.count + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE VIEW public.v_rank_neighborhood_30d AS
WITH base AS (
  SELECT
    n.id,
    n.slug,
    n.name,
    COALESCE(SUM(m.impact_score), 0) as impact_score,
    COALESCE(SUM(m.receipts_count), 0) as receipts_count,
    COALESCE(SUM(m.mutiroes_count), 0) as mutiroes_count,
    COALESCE(SUM(m.chamados_count), 0) as chamados_count,
    COALESCE(SUM(m.quality_ok_count), 0) as quality_ok_count,
    COALESCE(SUM(m.quality_attention_count), 0) as quality_attention_count,
    COALESCE(SUM(m.quality_contaminated_count), 0) as quality_contaminated_count
  FROM public.neighborhoods n
  LEFT JOIN public.metrics_daily m
    ON n.id = m.neighborhood_id
   AND m.day >= (CURRENT_DATE - INTERVAL '30 days')
  GROUP BY n.id, n.slug, n.name
)
SELECT
  b.id,
  b.slug,
  b.name,
  b.impact_score,
  b.receipts_count,
  b.mutiroes_count,
  b.chamados_count,
  b.quality_ok_count,
  b.quality_attention_count,
  b.quality_contaminated_count,
  CASE
    WHEN (b.quality_ok_count + b.quality_attention_count + b.quality_contaminated_count) = 0 THEN 0
    ELSE ROUND((100.0 * b.quality_ok_count) / (b.quality_ok_count + b.quality_attention_count + b.quality_contaminated_count), 2)
  END AS quality_ok_rate_30d,
  COALESCE((
    SELECT ARRAY_AGG(flag ORDER BY total_count DESC, flag ASC)
    FROM (
      SELECT q.flag, SUM(q.count) AS total_count
      FROM public.quality_flags_daily q
      WHERE q.neighborhood_id = b.id
        AND q.day >= (CURRENT_DATE - INTERVAL '30 days')
      GROUP BY q.flag
      ORDER BY total_count DESC, q.flag ASC
      LIMIT 3
    ) top_flags
  ), ARRAY[]::TEXT[]) AS contam_top_flags
FROM base b
ORDER BY b.impact_score DESC NULLS LAST;

INSERT INTO public.edu_tips (slug, title, body, material, flag, locale, active)
VALUES
  (
    'vr-tip-food-contamination',
    'Sem restos de comida',
    'Quando embalagens chegam com restos de comida, o lote inteiro perde valor e parte vira rejeito. Reserve 20 segundos para enxaguar rapidamente potes e garrafas antes de separar. Isso aumenta a chance de reaproveitamento real, melhora a renda da cooperativa e evita mau cheiro no trajeto até a triagem.',
    NULL,
    'food',
    'vr',
    true
  ),
  (
    'vr-tip-liquids-drain',
    'Escorra líquidos antes de separar',
    'Frascos com líquidos no fundo contaminam papel e outros materiais durante transporte e triagem. Antes de descartar, esvazie totalmente e deixe escorrer por alguns segundos. Esse cuidado simples reduz perdas, evita acidentes no manuseio e melhora a qualidade final do material enviado para reciclagem.',
    NULL,
    'liquids',
    'vr',
    true
  ),
  (
    'vr-tip-mixed-separate',
    'Separe por tipo de material',
    'Misturar vidro, metal, plástico e papel no mesmo saco dificulta a triagem e aumenta o tempo de processamento. Organizar por tipo, mesmo de forma básica, já melhora muito o aproveitamento. Pense em duas ou três sacolas fixas para criar rotina e manter a coleta recorrente com mais qualidade.',
    NULL,
    'mixed',
    'vr',
    true
  ),
  (
    'vr-tip-paper-dry',
    'Papel seco vale mais',
    'Papel e papelão úmidos perdem valor e podem virar rejeito no centro de triagem. Sempre que possível, mantenha esse material longe de líquidos e separado em embalagem seca. Com esse hábito, a coleta rende melhor para a cooperativa e o bairro sobe no indicador de qualidade sem depender de mais volume.',
    'paper',
    NULL,
    'vr',
    true
  ),
  (
    'vr-tip-generic-quality',
    'Pequenos cuidados, grande impacto',
    'Cada recibo é uma oportunidade de melhorar a qualidade da reciclagem no bairro. Separar por tipo, manter embalagens limpas e evitar mistura com resíduos orgânicos aumenta o aproveitamento real. O objetivo não é punir ninguém: é aprender em cada coleta para fortalecer renda local e previsibilidade da rota.',
    NULL,
    NULL,
    'vr',
    true
  )
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  material = EXCLUDED.material,
  flag = EXCLUDED.flag,
  locale = EXCLUDED.locale,
  active = EXCLUDED.active;

NOTIFY pgrst, 'reload schema';
