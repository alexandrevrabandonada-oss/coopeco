-- A7.3 fix: remove ambiguous scheduled_for reference in RPC idempotency path

CREATE OR REPLACE FUNCTION public.rpc_generate_recurring_requests(
  window_id UUID,
  scheduled_for TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  v_window RECORD;
  v_subscription RECORD;
  v_occurrence_id UUID;
  v_request_id UUID;
  v_scheduled_for TIMESTAMPTZ;
  v_existing_count INT := 0;
  generated_count INT := 0;
  skipped_existing_count INT := 0;
  skipped_paused_count INT := 0;
  skipped_invalid_count INT := 0;
  skipped_capacity_count INT := 0;
BEGIN
  IF actor_id IS NULL OR NOT public.has_role(ARRAY['operator'::public.app_role]) THEN
    RAISE EXCEPTION 'operator_only';
  END IF;

  SELECT rw.id, rw.neighborhood_id, rw.weekday, rw.start_time, rw.capacity
  INTO v_window
  FROM public.route_windows rw
  WHERE rw.id = window_id;

  IF v_window.id IS NULL THEN
    RAISE EXCEPTION 'window_not_found';
  END IF;

  v_scheduled_for := COALESCE(scheduled_for, public.eco_next_occurrence(v_window.weekday, v_window.start_time));

  SELECT COUNT(*)::INT
  INTO v_existing_count
  FROM public.pickup_requests pr
  WHERE pr.route_window_id = window_id
    AND pr.scheduled_for = v_scheduled_for;

  FOR v_subscription IN
    SELECT
      rs.id,
      rs.created_by,
      rs.neighborhood_id,
      rs.fulfillment_mode,
      rs.drop_point_id,
      rs.notes,
      rs.status,
      pap.address_full,
      pap.contact_phone,
      pap.geo_lat,
      pap.geo_lng
    FROM public.recurring_subscriptions rs
    LEFT JOIN public.pickup_address_profiles pap ON pap.user_id = rs.created_by
    WHERE rs.neighborhood_id = v_window.neighborhood_id
      AND rs.preferred_window_id = window_id
    ORDER BY rs.created_at ASC, rs.id ASC
  LOOP
    IF v_subscription.status <> 'active' THEN
      INSERT INTO public.recurring_occurrences (subscription_id, route_window_id, scheduled_for, status)
      SELECT v_subscription.id, window_id, v_scheduled_for, 'skipped_paused'
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.recurring_occurrences ro
        WHERE ro.subscription_id = v_subscription.id
          AND ro.scheduled_for = v_scheduled_for
      );
      IF FOUND THEN
        skipped_paused_count := skipped_paused_count + 1;
      ELSE
        skipped_existing_count := skipped_existing_count + 1;
      END IF;
      CONTINUE;
    END IF;

    INSERT INTO public.recurring_occurrences (subscription_id, route_window_id, scheduled_for, status)
    SELECT v_subscription.id, window_id, v_scheduled_for, 'generated'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.recurring_occurrences ro
      WHERE ro.subscription_id = v_subscription.id
        AND ro.scheduled_for = v_scheduled_for
    )
    RETURNING id INTO v_occurrence_id;

    IF v_occurrence_id IS NULL THEN
      skipped_existing_count := skipped_existing_count + 1;
      CONTINUE;
    END IF;

    IF (v_existing_count + generated_count) >= v_window.capacity THEN
      UPDATE public.recurring_occurrences
      SET status = 'skipped_capacity'
      WHERE id = v_occurrence_id;
      skipped_capacity_count := skipped_capacity_count + 1;
      EXIT;
    END IF;

    BEGIN
      IF v_subscription.fulfillment_mode = 'doorstep' THEN
        IF v_subscription.address_full IS NULL OR btrim(v_subscription.address_full) = '' THEN
          UPDATE public.recurring_occurrences
          SET status = 'skipped_invalid'
          WHERE id = v_occurrence_id;
          skipped_invalid_count := skipped_invalid_count + 1;
          CONTINUE;
        END IF;

        INSERT INTO public.pickup_requests (
          created_by,
          neighborhood_id,
          status,
          notes,
          route_window_id,
          scheduled_for,
          fulfillment_mode,
          is_recurring,
          subscription_id
        )
        VALUES (
          v_subscription.created_by,
          v_subscription.neighborhood_id,
          'open',
          COALESCE(v_subscription.notes, 'Gerado por recorrencia'),
          window_id,
          v_scheduled_for,
          'doorstep',
          true,
          v_subscription.id
        )
        RETURNING id INTO v_request_id;

        INSERT INTO public.pickup_request_private (
          request_id,
          address_full,
          contact_phone,
          geo_lat,
          geo_lng
        )
        VALUES (
          v_request_id,
          v_subscription.address_full,
          v_subscription.contact_phone,
          v_subscription.geo_lat,
          v_subscription.geo_lng
        );
      ELSE
        IF v_subscription.drop_point_id IS NULL THEN
          UPDATE public.recurring_occurrences
          SET status = 'skipped_invalid'
          WHERE id = v_occurrence_id;
          skipped_invalid_count := skipped_invalid_count + 1;
          CONTINUE;
        END IF;

        INSERT INTO public.pickup_requests (
          created_by,
          neighborhood_id,
          status,
          notes,
          route_window_id,
          scheduled_for,
          fulfillment_mode,
          drop_point_id,
          is_recurring,
          subscription_id
        )
        VALUES (
          v_subscription.created_by,
          v_subscription.neighborhood_id,
          'open',
          COALESCE(v_subscription.notes, 'Gerado por recorrencia'),
          window_id,
          v_scheduled_for,
          'drop_point',
          v_subscription.drop_point_id,
          true,
          v_subscription.id
        )
        RETURNING id INTO v_request_id;
      END IF;

      UPDATE public.recurring_occurrences
      SET request_id = v_request_id, status = 'generated'
      WHERE id = v_occurrence_id;
      generated_count := generated_count + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.recurring_occurrences
      SET status = 'skipped_invalid'
      WHERE id = v_occurrence_id;
      skipped_invalid_count := skipped_invalid_count + 1;
    END;

    v_occurrence_id := NULL;
    v_request_id := NULL;
  END LOOP;

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, meta)
  VALUES (
    actor_id,
    'recurring.generate.window',
    'system',
    NULL,
    jsonb_build_object(
      'window_id', window_id,
      'scheduled_for', v_scheduled_for,
      'generated', generated_count,
      'skipped_existing', skipped_existing_count,
      'skipped_paused', skipped_paused_count,
      'skipped_invalid', skipped_invalid_count,
      'skipped_capacity', skipped_capacity_count
    )
  );

  RETURN jsonb_build_object(
    'window_id', window_id,
    'scheduled_for', v_scheduled_for,
    'generated', generated_count,
    'skipped_existing', skipped_existing_count,
    'skipped_paused', skipped_paused_count,
    'skipped_invalid', skipped_invalid_count,
    'skipped_capacity', skipped_capacity_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_generate_recurring_requests(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_generate_recurring_requests(UUID, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
