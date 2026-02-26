-- A4.1 fix: remove period_id ambiguity inside payout rebuild helper.

DROP FUNCTION IF EXISTS public.proc_rebuild_payout_totals(UUID);

CREATE FUNCTION public.proc_rebuild_payout_totals(p_period_id UUID)
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
  WHERE p.id = p_period_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Periodo nao encontrado: %', p_period_id;
  END IF;

  IF v_period_status = 'paid' THEN
    RAISE EXCEPTION 'Periodo % ja pago; nao pode ser recalculado.', p_period_id;
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
    WHERE a.period_id = p_period_id
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
    RAISE EXCEPTION 'Existem payouts negativos no periodo %. Ajuste os lancamentos.', p_period_id;
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
    WHERE a.period_id = p_period_id
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
    p_period_id,
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
  WHERE p.period_id = p_period_id
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
        AND a.period_id = p_period_id
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
