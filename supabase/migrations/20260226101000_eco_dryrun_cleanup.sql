-- A4.2: Dry-run test marks + controlled cleanup (operator-only).

CREATE TABLE IF NOT EXISTS public.receipts_test_marks (
  receipt_id UUID PRIMARY KEY REFERENCES public.receipts(id) ON DELETE CASCADE,
  mark TEXT NOT NULL CHECK (upper(mark) IN ('DRYRUN', 'TEST')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_test_marks_mark_created
  ON public.receipts_test_marks(mark, created_at DESC);

ALTER TABLE public.receipts_test_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators read test marks" ON public.receipts_test_marks;
CREATE POLICY "Operators read test marks"
ON public.receipts_test_marks
FOR SELECT
USING (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators write test marks" ON public.receipts_test_marks;
CREATE POLICY "Operators write test marks"
ON public.receipts_test_marks
FOR ALL
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- Keep ledger immutable in normal operation, but allow DELETE for marked test
-- receipts only while the cleanup RPC explicitly enables it in-session.
CREATE OR REPLACE FUNCTION public.proc_block_ledger_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('eco.allow_test_cleanup', true) = 'on'
     AND EXISTS (
       SELECT 1
       FROM public.receipts_test_marks tm
       WHERE tm.receipt_id = OLD.receipt_id
         AND upper(tm.mark) IN ('DRYRUN', 'TEST')
     ) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'coop_earnings_ledger is immutable: UPDATE/DELETE are not allowed';
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_cleanup_dryrun(cutoff_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_cutoff TIMESTAMPTZ;
  v_deleted_periods INT := 0;
  v_deleted_payouts INT := 0;
  v_deleted_adjustments INT := 0;
  v_deleted_posts INT := 0;
  v_deleted_ledger INT := 0;
  v_deleted_receipts INT := 0;
  v_deleted_requests INT := 0;
  v_target_receipts INT := 0;
BEGIN
  IF NOT public.has_role(ARRAY['operator'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF cutoff_days < 0 THEN
    RAISE EXCEPTION 'cutoff_days invalido: %', cutoff_days;
  END IF;

  v_cutoff := now() - make_interval(days => cutoff_days);

  CREATE TEMP TABLE tmp_cleanup_periods (
    id UUID PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO tmp_cleanup_periods (id)
  SELECT DISTINCT p.id
  FROM public.coop_payout_periods p
  JOIN public.coop_payouts po
    ON po.period_id = p.id
  WHERE upper(coalesce(po.payout_reference, '')) IN ('DRYRUN', 'TEST')
    AND coalesce(p.paid_at, p.closed_at, p.created_at) <= v_cutoff;

  SELECT count(*)
  INTO v_deleted_adjustments
  FROM public.coop_earning_adjustments a
  WHERE a.period_id IN (SELECT id FROM tmp_cleanup_periods);

  DELETE FROM public.coop_payouts po
  WHERE po.period_id IN (SELECT id FROM tmp_cleanup_periods);
  GET DIAGNOSTICS v_deleted_payouts = ROW_COUNT;

  DELETE FROM public.coop_payout_periods p
  WHERE p.id IN (SELECT id FROM tmp_cleanup_periods);
  GET DIAGNOSTICS v_deleted_periods = ROW_COUNT;

  CREATE TEMP TABLE tmp_cleanup_receipts (
    receipt_id UUID PRIMARY KEY,
    request_id UUID NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_cleanup_receipts (receipt_id, request_id)
  SELECT r.id, r.request_id
  FROM public.receipts r
  JOIN public.receipts_test_marks tm
    ON tm.receipt_id = r.id
  WHERE upper(tm.mark) IN ('DRYRUN', 'TEST')
    AND tm.created_at <= v_cutoff;

  SELECT count(*) INTO v_target_receipts FROM tmp_cleanup_receipts;

  DELETE FROM public.posts pst
  WHERE pst.receipt_id IN (SELECT receipt_id FROM tmp_cleanup_receipts);
  GET DIAGNOSTICS v_deleted_posts = ROW_COUNT;

  PERFORM set_config('eco.allow_test_cleanup', 'on', true);

  DELETE FROM public.coop_earnings_ledger led
  WHERE led.receipt_id IN (SELECT receipt_id FROM tmp_cleanup_receipts)
    AND EXISTS (
      SELECT 1
      FROM public.receipts_test_marks tm
      WHERE tm.receipt_id = led.receipt_id
        AND upper(tm.mark) IN ('DRYRUN', 'TEST')
    );
  GET DIAGNOSTICS v_deleted_ledger = ROW_COUNT;

  PERFORM set_config('eco.allow_test_cleanup', 'off', true);

  DELETE FROM public.receipts r
  WHERE r.id IN (SELECT receipt_id FROM tmp_cleanup_receipts);
  GET DIAGNOSTICS v_deleted_receipts = ROW_COUNT;

  DELETE FROM public.pickup_requests pr
  WHERE pr.id IN (SELECT request_id FROM tmp_cleanup_receipts)
    AND NOT EXISTS (
      SELECT 1
      FROM public.receipts r
      WHERE r.request_id = pr.id
    );
  GET DIAGNOSTICS v_deleted_requests = ROW_COUNT;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, meta)
  VALUES (
    v_actor_id,
    'cleanup_dryrun',
    'system',
    NULL,
    jsonb_build_object(
      'cutoff_days', cutoff_days,
      'deleted_periods', v_deleted_periods,
      'deleted_payouts', v_deleted_payouts,
      'deleted_adjustments', v_deleted_adjustments,
      'deleted_posts', v_deleted_posts,
      'deleted_ledger', v_deleted_ledger,
      'deleted_receipts', v_deleted_receipts,
      'deleted_requests', v_deleted_requests,
      'target_receipts', v_target_receipts
    )
  );

  RETURN jsonb_build_object(
    'cutoff_days', cutoff_days,
    'deleted_periods', v_deleted_periods,
    'deleted_payouts', v_deleted_payouts,
    'deleted_adjustments', v_deleted_adjustments,
    'deleted_posts', v_deleted_posts,
    'deleted_ledger', v_deleted_ledger,
    'deleted_receipts', v_deleted_receipts,
    'deleted_requests', v_deleted_requests,
    'target_receipts', v_target_receipts
  );
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('eco.allow_test_cleanup', 'off', true);
    RAISE;
END;
$$;

NOTIFY pgrst, 'reload schema';
