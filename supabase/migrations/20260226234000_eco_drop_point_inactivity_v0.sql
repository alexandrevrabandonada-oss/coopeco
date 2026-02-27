-- Migration: Inatividade de Ponto ECO (A15.4)
-- Detectar pontos sem movimento e permitir reativação via alertas.

-- A) View: v_drop_point_inactivity_14d
-- Calcula o tempo desde a última atividade (pedido ou recebimento)
CREATE OR REPLACE VIEW public.v_drop_point_inactivity_14d AS
WITH last_request AS (
    SELECT 
        drop_point_id,
        MAX(created_at) as last_request_at
    FROM public.route_requests
    WHERE type = 'drop_point'
    GROUP BY drop_point_id
),
last_receipt AS (
    SELECT 
        rr.drop_point_id,
        MAX(r.created_at) as last_receipt_at
    FROM public.receipts r
    JOIN public.route_requests rr ON r.request_id = rr.id
    WHERE rr.type = 'drop_point'
    GROUP BY rr.drop_point_id
)
SELECT 
    edp.id as drop_point_id,
    edp.neighborhood_id,
    edp.name,
    EXTRACT(DAY FROM (now() - COALESCE(lr.last_request_at, edp.created_at)))::int as days_since_last_request,
    EXTRACT(DAY FROM (now() - COALESCE(lrc.last_receipt_at, edp.created_at)))::int as days_since_last_receipt,
    CASE 
        WHEN EXTRACT(DAY FROM (now() - COALESCE(lr.last_request_at, edp.created_at))) >= 14 THEN 'inactive'
        WHEN EXTRACT(DAY FROM (now() - COALESCE(lr.last_request_at, edp.created_at))) >= 7 THEN 'stale'
        ELSE 'active'
    END as status
FROM public.eco_drop_points edp
LEFT JOIN last_request lr ON edp.id = lr.drop_point_id
LEFT JOIN last_receipt lrc ON edp.id = lrc.drop_point_id
WHERE edp.active = true;

-- B) View: v_drop_point_health_14d
-- Estatísticas de saúde dos pontos nas últimas 2 semanas
CREATE OR REPLACE VIEW public.v_drop_point_health_14d AS
SELECT 
    rr.drop_point_id,
    COUNT(*) as requests_14d,
    COUNT(r.id) as receipts_14d,
    CASE 
        WHEN COUNT(r.id) > 0 THEN (COUNT(*) FILTER (WHERE r.status = 'ok')::float / COUNT(r.id)::float)
        ELSE 0 
    END as ok_rate_14d,
    string_agg(DISTINCT r.flag_id, ', ') as top_flags_14d
FROM public.route_requests rr
LEFT JOIN public.receipts r ON rr.id = r.request_id
WHERE rr.type = 'drop_point'
  AND rr.created_at >= (now() - INTERVAL '14 days')
GROUP BY rr.drop_point_id;

-- C) Atualizar rpc_refresh_ops_alerts (A15.1)
-- Incluir alertas de inatividade
CREATE OR REPLACE FUNCTION public.rpc_refresh_ops_alerts(p_neighborhood_id UUID)
RETURNS void AS $$
DECLARE
    alert_record RECORD;
    notif_id UUID;
    operator_role_id UUID;
BEGIN
    -- Obter role de operador (ajustar conforme seu schema de roles)
    -- Para COOP ECO, costumamos usar profiles.role = 'operator' ou similar.
    -- Aqui usaremos a lógica de enviar para quem tem acesso admin.

    -- 1. Janelas Lotadas / Qualidade Baixa (A15.1) - Candidatos
    FOR alert_record IN (
        SELECT * FROM public.v_ops_alert_candidates_7d 
        WHERE neighborhood_id = p_neighborhood_id
    ) LOOP
        INSERT INTO public.ops_alerts (kind, severity, entity_id, message, date_bucket)
        VALUES (
            alert_record.kind,
            alert_record.severity,
            alert_record.entity_id,
            alert_record.message,
            CURRENT_DATE
        )
        ON CONFLICT (kind, entity_id, date_bucket) DO NOTHING;

        -- Se foi inserido agora (ou se quisermos garantir notif), criar user_notifications
        -- Filtro de deduplicação manual para notificações no mesmo dia
        IF NOT EXISTS (
            SELECT 1 FROM public.user_notifications 
            WHERE category = 'ops_alert' 
              AND metadata->>'entity_id' = alert_record.entity_id::text
              AND created_at::date = CURRENT_DATE
        ) THEN
            -- Para Operadores (todos)
            INSERT INTO public.user_notifications (user_id, title, message, category, metadata)
            SELECT p.id, 
                   'Alerta Operacional: ' || alert_record.kind,
                   alert_record.message,
                   'ops_alert',
                   jsonb_build_object('entity_id', alert_record.entity_id, 'severity', alert_record.severity)
            FROM public.profiles p
            WHERE p.role = 'operator';

            -- Para Cooperados do bairro (apenas critical)
            IF alert_record.severity = 'critical' THEN
                INSERT INTO public.user_notifications (user_id, title, message, category, metadata)
                SELECT p.id, 
                   'Risco Logístico: ' || alert_record.kind,
                   alert_record.message,
                   'ops_alert',
                   jsonb_build_object('entity_id', alert_record.entity_id, 'severity', alert_record.severity)
                FROM public.profiles p
                WHERE p.role = 'cooperado' AND p.neighborhood_id = p_neighborhood_id;
            END IF;
        END IF;
    END LOOP;

    -- 2. Pontos ECO Inativos (A15.4)
    FOR alert_record IN (
        SELECT 
            drop_point_id,
            name,
            status,
            days_since_last_request
        FROM public.v_drop_point_inactivity_14d
        WHERE neighborhood_id = p_neighborhood_id AND status IN ('stale', 'inactive')
    ) LOOP
        INSERT INTO public.ops_alerts (kind, severity, entity_id, message, date_bucket)
        VALUES (
            'drop_point_inactive',
            CASE WHEN alert_record.status = 'inactive' THEN 'critical' ELSE 'warn' END,
            alert_record.drop_point_id,
            'Ponto ' || alert_record.name || ' sem pedidos há ' || alert_record.days_since_last_request || ' dias.',
            CURRENT_DATE
        )
        ON CONFLICT (kind, entity_id, date_bucket) DO NOTHING;

        -- Notificação se for critical (inactive)
        IF alert_record.status = 'inactive' AND NOT EXISTS (
            SELECT 1 FROM public.user_notifications 
            WHERE category = 'ops_alert' 
              AND metadata->>'entity_id' = alert_record.drop_point_id::text
              AND created_at::date = CURRENT_DATE
        ) THEN
            INSERT INTO public.user_notifications (user_id, title, message, category, metadata)
            SELECT p.id, 
                   'Ponto Inativo: ' || alert_record.name,
                   'Ponto sem movimento há 14 dias. Considere reativar.',
                   'ops_alert',
                   jsonb_build_object('entity_id', alert_record.drop_point_id, 'severity', 'critical')
            FROM public.profiles p
            WHERE p.role = 'operator';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 Jackson
