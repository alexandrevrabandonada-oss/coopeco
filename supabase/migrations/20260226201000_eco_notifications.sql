-- A7.4: notificacoes in-app minimas para recorrencia e operacao

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'recurring_skipped_invalid',
    'recurring_skipped_capacity',
    'request_status',
    'receipt_ready',
    'window_queue_ready'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  entity_type TEXT CHECK (entity_type IN ('subscription', 'request', 'receipt', 'window')),
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread_created
  ON public.user_notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_entity
  ON public.user_notifications (entity_type, entity_id);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.user_notifications;
CREATE POLICY "Users read own notifications"
ON public.user_notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications read flag" ON public.user_notifications;
CREATE POLICY "Users update own notifications read flag"
ON public.user_notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Operators insert notifications" ON public.user_notifications;
CREATE POLICY "Operators insert notifications"
ON public.user_notifications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

REVOKE ALL ON public.user_notifications FROM anon;
GRANT SELECT ON public.user_notifications TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_notifications FROM authenticated;
GRANT INSERT ON public.user_notifications TO authenticated;
GRANT UPDATE (is_read) ON public.user_notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_mark_notifications_read(
  ids UUID[] DEFAULT NULL,
  mark_all BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  changed_count INT := 0;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF mark_all THEN
    UPDATE public.user_notifications
    SET is_read = true
    WHERE user_id = actor_id
      AND is_read = false;
  ELSE
    IF ids IS NULL OR array_length(ids, 1) IS NULL THEN
      RETURN 0;
    END IF;

    UPDATE public.user_notifications
    SET is_read = true
    WHERE user_id = actor_id
      AND id = ANY(ids)
      AND is_read = false;
  END IF;

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_mark_notifications_read(UUID[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_mark_notifications_read(UUID[], BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.eco_notify_request_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notify_title TEXT;
  notify_body TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'accepted' THEN
    notify_title := 'Coleta confirmada';
    notify_body := 'Um cooperado assumiu seu pedido. Acompanhe o andamento no painel de pedidos.';
  ELSIF NEW.status = 'en_route' THEN
    notify_title := 'Cooperado a caminho';
    notify_body := 'Sua coleta entrou em rota. Prepare os materiais para agilizar o atendimento.';
  ELSIF NEW.status = 'collected' THEN
    notify_title := 'Coleta concluida';
    notify_body := 'A coleta foi concluida. O recibo sera disponibilizado em seguida.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (
    user_id,
    kind,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  VALUES (
    NEW.created_by,
    'request_status',
    notify_title,
    notify_body,
    '/pedidos',
    'request',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pickup_requests_notify_status ON public.pickup_requests;
CREATE TRIGGER tr_pickup_requests_notify_status
AFTER UPDATE OF status ON public.pickup_requests
FOR EACH ROW
EXECUTE FUNCTION public.eco_notify_request_status();

CREATE OR REPLACE FUNCTION public.eco_notify_receipt_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_owner UUID;
BEGIN
  SELECT pr.created_by
  INTO request_owner
  FROM public.pickup_requests pr
  WHERE pr.id = NEW.request_id;

  IF request_owner IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_notifications (
    user_id,
    kind,
    title,
    body,
    action_url,
    entity_type,
    entity_id
  )
  VALUES (
    request_owner,
    'receipt_ready',
    'Seu Recibo ECO esta pronto',
    'Confira o recibo e a dica do dia para melhorar a separacao.',
    '/recibos/' || NEW.id::text,
    'receipt',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_receipts_notify_ready ON public.receipts;
CREATE TRIGGER tr_receipts_notify_ready
AFTER INSERT ON public.receipts
FOR EACH ROW
EXECUTE FUNCTION public.eco_notify_receipt_ready();

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

      INSERT INTO public.user_notifications (
        user_id,
        kind,
        title,
        body,
        action_url,
        entity_type,
        entity_id
      )
      SELECT
        v_subscription.created_by,
        'recurring_skipped_capacity',
        'A proxima janela lotou',
        'Sua recorrencia sera gerada na proxima janela disponivel.',
        '/recorrencia',
        'window',
        window_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.user_notifications n
        WHERE n.user_id = v_subscription.created_by
          AND n.kind = 'recurring_skipped_capacity'
          AND n.entity_type = 'window'
          AND n.entity_id = window_id
          AND n.created_at >= (now() - INTERVAL '12 hours')
      );

      EXIT;
    END IF;

    BEGIN
      IF v_subscription.fulfillment_mode = 'doorstep' THEN
        IF v_subscription.address_full IS NULL OR btrim(v_subscription.address_full) = '' THEN
          UPDATE public.recurring_occurrences
          SET status = 'skipped_invalid'
          WHERE id = v_occurrence_id;
          skipped_invalid_count := skipped_invalid_count + 1;

          INSERT INTO public.user_notifications (
            user_id,
            kind,
            title,
            body,
            action_url,
            entity_type,
            entity_id
          )
          SELECT
            v_subscription.created_by,
            'recurring_skipped_invalid',
            'Faltou um dado pra sua recorrencia',
            'Para a coleta na porta, cadastre seu endereco de coleta. Sua recorrencia ficou em espera.',
            '/perfil/endereco',
            'subscription',
            v_subscription.id
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.user_notifications n
            WHERE n.user_id = v_subscription.created_by
              AND n.kind = 'recurring_skipped_invalid'
              AND n.entity_type = 'subscription'
              AND n.entity_id = v_subscription.id
              AND n.created_at >= (now() - INTERVAL '12 hours')
          );
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

          INSERT INTO public.user_notifications (
            user_id,
            kind,
            title,
            body,
            action_url,
            entity_type,
            entity_id
          )
          SELECT
            v_subscription.created_by,
            'recurring_skipped_invalid',
            'Faltou um dado pra sua recorrencia',
            'Sua configuracao de recorrencia precisa de ajuste para voltar a gerar pedidos.',
            '/recorrencia',
            'subscription',
            v_subscription.id
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.user_notifications n
            WHERE n.user_id = v_subscription.created_by
              AND n.kind = 'recurring_skipped_invalid'
              AND n.entity_type = 'subscription'
              AND n.entity_id = v_subscription.id
              AND n.created_at >= (now() - INTERVAL '12 hours')
          );
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

  IF generated_count > 0 THEN
    INSERT INTO public.user_notifications (
      user_id,
      kind,
      title,
      body,
      action_url,
      entity_type,
      entity_id
    )
    SELECT
      p.user_id,
      'window_queue_ready',
      'Nova fila na proxima janela',
      'Ha novas coletas programadas para a proxima janela do bairro.',
      '/cooperado',
      'window',
      window_id
    FROM public.profiles p
    WHERE p.role = 'cooperado'::public.app_role
      AND p.neighborhood_id = v_window.neighborhood_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_notifications n
        WHERE n.user_id = p.user_id
          AND n.kind = 'window_queue_ready'
          AND n.entity_type = 'window'
          AND n.entity_id = window_id
          AND n.created_at >= (now() - INTERVAL '2 hours')
      );
  END IF;

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
