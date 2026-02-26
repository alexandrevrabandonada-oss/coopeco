-- A4.1: Payout adjustments + audit-safe operational RPCs

-- 1) Ledger immutability guard (no UPDATE/DELETE)
CREATE OR REPLACE FUNCTION public.proc_block_ledger_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'coop_earnings_ledger is immutable: UPDATE/DELETE are not allowed';
END;
$$;

DROP TRIGGER IF EXISTS tr_block_ledger_mutations ON public.coop_earnings_ledger;
CREATE TRIGGER tr_block_ledger_mutations
BEFORE UPDATE OR DELETE ON public.coop_earnings_ledger
FOR EACH ROW EXECUTE FUNCTION public.proc_block_ledger_mutations();

-- 2) Audit-friendly adjustments table
CREATE TABLE IF NOT EXISTS public.coop_earning_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperado_id UUID NOT NULL REFERENCES public.profiles(user_id),
  period_id UUID NOT NULL REFERENCES public.coop_payout_periods(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  created_by UUID NOT NULL REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coop_adj_period_cooperado
ON public.coop_earning_adjustments(period_id, cooperado_id);

ALTER TABLE public.coop_earning_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cooperados see own adjustments" ON public.coop_earning_adjustments;
CREATE POLICY "Cooperados see own adjustments"
ON public.coop_earning_adjustments
FOR SELECT
USING (auth.uid() = cooperado_id);

DROP POLICY IF EXISTS "Operators manage adjustments" ON public.coop_earning_adjustments;
CREATE POLICY "Operators manage adjustments"
ON public.coop_earning_adjustments
FOR ALL
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- 3) Internal payout rebuild helper
CREATE OR REPLACE FUNCTION public.proc_rebuild_payout_totals(period_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_period_status TEXT;
  v_negative_count INT;
BEGIN
  SELECT p.period_start, p.period_end, p.status
  INTO v_period_start, v_period_end, v_period_status
  FROM public.coop_payout_periods p
  WHERE p.id = period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Periodo nao encontrado: %', period_id;
  END IF;

  IF v_period_status = 'paid' THEN
    RAISE EXCEPTION 'Periodo % ja pago; nao pode ser recalculado.', period_id;
  END IF;

  WITH ledger_totals AS (
    SELECT
      l.cooperado_id,
      SUM(l.total_cents)::INT AS ledger_sum
    FROM public.coop_earnings_ledger l
    WHERE l.created_at::DATE BETWEEN v_period_start AND v_period_end
    GROUP BY l.cooperado_id
  ),
  adjustment_totals AS (
    SELECT
      a.cooperado_id,
      SUM(a.amount_cents)::INT AS adjustments_sum
    FROM public.coop_earning_adjustments a
    WHERE a.period_id = period_id
    GROUP BY a.cooperado_id
  ),
  merged AS (
    SELECT
      COALESCE(l.cooperado_id, a.cooperado_id) AS cooperado_id,
      COALESCE(l.ledger_sum, 0)::INT AS ledger_sum,
      COALESCE(a.adjustments_sum, 0)::INT AS adjustments_sum,
      (COALESCE(l.ledger_sum, 0) + COALESCE(a.adjustments_sum, 0))::INT AS payout_total
    FROM ledger_totals l
    FULL OUTER JOIN adjustment_totals a ON a.cooperado_id = l.cooperado_id
  )
  SELECT count(*) INTO v_negative_count FROM merged WHERE payout_total < 0;

  IF v_negative_count > 0 THEN
    RAISE EXCEPTION 'Existem payouts negativos no periodo %. Ajuste os lancamentos.', period_id;
  END IF;

  WITH ledger_totals AS (
    SELECT
      l.cooperado_id,
      SUM(l.total_cents)::INT AS ledger_sum
    FROM public.coop_earnings_ledger l
    WHERE l.created_at::DATE BETWEEN v_period_start AND v_period_end
    GROUP BY l.cooperado_id
  ),
  adjustment_totals AS (
    SELECT
      a.cooperado_id,
      SUM(a.amount_cents)::INT AS adjustments_sum
    FROM public.coop_earning_adjustments a
    WHERE a.period_id = period_id
    GROUP BY a.cooperado_id
  ),
  merged AS (
    SELECT
      COALESCE(l.cooperado_id, a.cooperado_id) AS cooperado_id,
      (COALESCE(l.ledger_sum, 0) + COALESCE(a.adjustments_sum, 0))::INT AS payout_total
    FROM ledger_totals l
    FULL OUTER JOIN adjustment_totals a ON a.cooperado_id = l.cooperado_id
  )
  INSERT INTO public.coop_payouts (
    cooperado_id,
    period_id,
    total_cents,
    status,
    payout_reference,
    created_at,
    paid_at
  )
  SELECT
    m.cooperado_id,
    period_id,
    m.payout_total,
    'pending',
    NULL,
    now(),
    NULL
  FROM merged m
  WHERE m.payout_total > 0
  ON CONFLICT (cooperado_id, period_id) DO UPDATE
  SET
    total_cents = EXCLUDED.total_cents,
    status = CASE WHEN public.coop_payouts.status = 'paid' THEN public.coop_payouts.status ELSE 'pending' END,
    payout_reference = CASE WHEN public.coop_payouts.status = 'paid' THEN public.coop_payouts.payout_reference ELSE NULL END,
    paid_at = CASE WHEN public.coop_payouts.status = 'paid' THEN public.coop_payouts.paid_at ELSE NULL END;

  DELETE FROM public.coop_payouts p
  WHERE p.period_id = period_id
    AND p.status <> 'paid'
    AND NOT EXISTS (
      SELECT 1
      FROM public.coop_earnings_ledger l
      WHERE l.cooperado_id = p.cooperado_id
        AND l.created_at::DATE BETWEEN v_period_start AND v_period_end
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.coop_earning_adjustments a
      WHERE a.cooperado_id = p.cooperado_id
        AND a.period_id = period_id
    );
END;
$$;

-- 4) Operator-only RPCs (named params as required)

CREATE OR REPLACE FUNCTION public.rpc_create_payout_period(period_start DATE, period_end DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_id UUID;
BEGIN
  IF NOT public.has_role(ARRAY['operator'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF period_start IS NULL OR period_end IS NULL OR period_start > period_end THEN
    RAISE EXCEPTION 'Periodo invalido';
  END IF;

  INSERT INTO public.coop_payout_periods (period_start, period_end, status)
  VALUES (period_start, period_end, 'open')
  RETURNING id INTO v_period_id;

  RETURN v_period_id;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_close_payout_period(UUID);
CREATE OR REPLACE FUNCTION public.rpc_close_payout_period(period_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NOT public.has_role(ARRAY['operator'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT status INTO v_status
  FROM public.coop_payout_periods
  WHERE id = period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Periodo nao encontrado';
  END IF;

  IF v_status = 'paid' THEN
    RAISE EXCEPTION 'Periodo ja pago; fechamento bloqueado';
  END IF;

  UPDATE public.coop_payout_periods
  SET status = 'closed',
      closed_at = COALESCE(closed_at, now())
  WHERE id = period_id;

  PERFORM public.proc_rebuild_payout_totals(period_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_mark_payout_paid(period_id UUID, payout_reference TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NOT public.has_role(ARRAY['operator'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT status INTO v_status
  FROM public.coop_payout_periods
  WHERE id = period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Periodo nao encontrado';
  END IF;

  IF v_status <> 'closed' THEN
    RAISE EXCEPTION 'Periodo precisa estar fechado para marcar como pago';
  END IF;

  UPDATE public.coop_payouts
  SET status = 'paid',
      payout_reference = rpc_mark_payout_paid.payout_reference,
      paid_at = now()
  WHERE public.coop_payouts.period_id = rpc_mark_payout_paid.period_id;

  UPDATE public.coop_payout_periods
  SET status = 'paid',
      paid_at = now()
  WHERE public.coop_payout_periods.id = rpc_mark_payout_paid.period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_add_adjustment(
  cooperado_id UUID,
  period_id UUID,
  amount_cents INT,
  reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adjustment_id UUID;
  v_period_status TEXT;
BEGIN
  IF NOT public.has_role(ARRAY['operator'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF reason IS NULL OR length(trim(reason)) = 0 THEN
    RAISE EXCEPTION 'Motivo do ajuste e obrigatorio';
  END IF;

  SELECT status INTO v_period_status
  FROM public.coop_payout_periods
  WHERE id = period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Periodo nao encontrado';
  END IF;

  IF v_period_status = 'paid' THEN
    RAISE EXCEPTION 'Periodo ja pago; ajuste bloqueado';
  END IF;

  INSERT INTO public.coop_earning_adjustments (
    cooperado_id,
    period_id,
    amount_cents,
    reason,
    created_by
  )
  VALUES (
    cooperado_id,
    period_id,
    amount_cents,
    reason,
    auth.uid()
  )
  RETURNING id INTO v_adjustment_id;

  IF v_period_status = 'closed' THEN
    PERFORM public.proc_rebuild_payout_totals(period_id);
  END IF;

  RETURN v_adjustment_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
