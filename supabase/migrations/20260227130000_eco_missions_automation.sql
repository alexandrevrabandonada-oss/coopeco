-- Migration: A17.1 — Automação de Missões do Comum (V2)
-- Garante que o progresso das missões seja atualizado automaticamente e de forma idempotente.

-- 1. Tabela de Deduplicação de Eventos de Missão
-- Aumentada com source_kind para permitir múltiplos tipos de eventos por missão.
DROP TABLE IF EXISTS public.mission_event_links CASCADE;
CREATE TABLE public.mission_event_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES public.community_missions(id) ON DELETE CASCADE,
    source_kind TEXT NOT NULL, -- 'invite_event', 'subscription', 'anchor', 'promotion', 'receipt'
    source_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mission_id, source_kind, source_id)
);

-- RLS: mission_event_links
ALTER TABLE public.mission_event_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators can view mission event links" ON public.mission_event_links FOR SELECT TO authenticated USING (public.has_role(ARRAY['operator'::public.app_role]));

-- 2. Helpers para Escopo (Sem PII)
CREATE OR REPLACE FUNCTION public.fn_invite_scope(p_code_id UUID)
RETURNS TABLE(scope TEXT, neighborhood_id UUID, drop_point_id UUID, partner_id UUID) AS $$
    SELECT ic.scope, ic.neighborhood_id, ic.drop_point_id, ic.partner_id
    FROM public.invite_codes ic
    WHERE ic.id = p_code_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.fn_user_neighborhood(p_user_id UUID)
RETURNS UUID AS $$
    SELECT neighborhood_id FROM public.profiles WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- 3. RPC de Aplicação de Eventos (Security Definer)
-- Aplica eventos em massa para um período ou neighborhood.
CREATE OR REPLACE FUNCTION public.rpc_apply_mission_events(
    p_since TIMESTAMPTZ DEFAULT (now() - interval '14 days'), 
    p_until TIMESTAMPTZ DEFAULT now(),
    p_neighborhood_id UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_mission RECORD;
    v_new_links_count INT;
BEGIN
    -- Validar role (operator-only)
    IF NOT public.has_role(ARRAY['operator'::public.app_role]) THEN
        RAISE EXCEPTION 'Acesso negado: apenas operadores podem recalcular missões.';
    END IF;

    -- Iterar por missões ativas no escopo
    FOR v_mission IN (
        SELECT m.* 
        FROM public.community_missions m
        WHERE m.active = true
          AND (p_neighborhood_id IS NULL OR m.neighborhood_id = p_neighborhood_id)
    ) LOOP
        
        -- 3.1: bring_neighbor (invite_events)
        IF v_mission.kind = 'bring_neighbor' THEN
            WITH inserted AS (
                INSERT INTO public.mission_event_links (mission_id, source_kind, source_id)
                SELECT v_mission.id, 'invite_event', ie.id
                FROM public.invite_events ie
                JOIN public.invite_codes ic ON ic.id = ie.code_id
                WHERE ie.event_kind = 'first_action_done'
                  AND ie.created_at BETWEEN p_since AND p_until
                  AND (
                    (v_mission.scope = 'neighborhood' AND ic.neighborhood_id = v_mission.neighborhood_id) OR
                    (v_mission.scope = 'drop_point' AND ic.drop_point_id = v_mission.drop_point_id)
                  )
                ON CONFLICT (mission_id, source_kind, source_id) DO NOTHING
                RETURNING 1
            )
            SELECT COUNT(*) INTO v_new_links_count FROM inserted;
            
            IF v_new_links_count > 0 THEN
                UPDATE public.mission_progress 
                SET progress_count = progress_count + v_new_links_count, updated_at = now() 
                WHERE mission_id = v_mission.id;
            END IF;

        -- 3.2: start_recurring (subscriptions)
        ELSIF v_mission.kind = 'start_recurring' THEN
            WITH inserted AS (
                INSERT INTO public.mission_event_links (mission_id, source_kind, source_id)
                SELECT v_mission.id, 'subscription', rs.id
                FROM public.recurring_subscriptions rs
                WHERE rs.status = 'active'
                  AND rs.created_at BETWEEN p_since AND p_until
                  AND rs.neighborhood_id = v_mission.neighborhood_id
                ON CONFLICT (mission_id, source_kind, source_id) DO NOTHING
                RETURNING 1
            )
            SELECT COUNT(*) INTO v_new_links_count FROM inserted;

            IF v_new_links_count > 0 THEN
                UPDATE public.mission_progress 
                SET progress_count = progress_count + v_new_links_count, updated_at = now() 
                WHERE mission_id = v_mission.id;
            END IF;

        -- 3.3: become_anchor (anchor_commitments)
        ELSIF v_mission.kind = 'become_anchor' THEN
            WITH inserted AS (
                INSERT INTO public.mission_event_links (mission_id, source_kind, source_id)
                SELECT v_mission.id, 'anchor', ac.id
                FROM public.anchor_commitments ac
                JOIN public.partners p ON p.id = ac.partner_id
                WHERE ac.status = 'active'
                  AND ac.created_at BETWEEN p_since AND p_until
                  AND p.neighborhood_id = v_mission.neighborhood_id
                ON CONFLICT (mission_id, source_kind, source_id) DO NOTHING
                RETURNING 1
            )
            SELECT COUNT(*) INTO v_new_links_count FROM inserted;

            IF v_new_links_count > 0 THEN
                UPDATE public.mission_progress 
                SET progress_count = progress_count + v_new_links_count, updated_at = now() 
                WHERE mission_id = v_mission.id;
            END IF;

        -- 3.4: reactivate_point (drop_point_promotions)
        ELSIF v_mission.kind = 'reactivate_point' THEN
            WITH inserted AS (
                INSERT INTO public.mission_event_links (mission_id, source_kind, source_id)
                SELECT v_mission.id, 'promotion', dpp.id
                FROM public.drop_point_promotions dpp
                WHERE dpp.created_at BETWEEN p_since AND p_until
                  AND (
                    (v_mission.scope = 'drop_point' AND dpp.drop_point_id = v_mission.drop_point_id) OR
                    (v_mission.scope = 'neighborhood' AND dpp.neighborhood_id = v_mission.neighborhood_id)
                  )
                ON CONFLICT (mission_id, source_kind, source_id) DO NOTHING
                RETURNING 1
            )
            SELECT COUNT(*) INTO v_new_links_count FROM inserted;

            IF v_new_links_count > 0 THEN
                UPDATE public.mission_progress 
                SET progress_count = progress_count + v_new_links_count, updated_at = now() 
                WHERE mission_id = v_mission.id;
            END IF;

        -- 3.5: quality_push (receipts with quality ok)
        ELSIF v_mission.kind = 'quality_push' THEN
            WITH inserted AS (
                INSERT INTO public.mission_event_links (mission_id, source_kind, source_id)
                SELECT v_mission.id, 'receipt', r.id
                FROM public.receipts r
                JOIN public.pickup_requests pr ON pr.id = r.request_id
                WHERE r.quality_status = 'ok'
                  AND r.created_at BETWEEN p_since AND p_until
                  AND (
                    (v_mission.scope = 'neighborhood' AND pr.neighborhood_id = v_mission.neighborhood_id) OR
                    (v_mission.scope = 'drop_point' AND pr.drop_point_id = v_mission.drop_point_id)
                  )
                ON CONFLICT (mission_id, source_kind, source_id) DO NOTHING
                RETURNING 1
            )
            SELECT COUNT(*) INTO v_new_links_count FROM inserted;

            IF v_new_links_count > 0 THEN
                UPDATE public.mission_progress 
                SET progress_count = progress_count + v_new_links_count, updated_at = now() 
                WHERE mission_id = v_mission.id;
            END IF;

        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Triggers Automáticos (Capa de Automação Silenciosa)

-- 4.1 Trigger para Primeiro Pedido Concluído (bring_neighbor)
CREATE OR REPLACE FUNCTION public.fn_on_invite_event_auto_mission()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_kind = 'first_action_done' THEN
        -- Tenta aplicar missões nos últimos 2 minutos para este evento específico
        PERFORM public.rpc_apply_mission_events(now() - interval '2 minutes', now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_invite_event_auto_mission ON public.invite_events;
CREATE TRIGGER tr_invite_event_auto_mission
AFTER INSERT ON public.invite_events
FOR EACH ROW EXECUTE FUNCTION public.fn_on_invite_event_auto_mission();

-- 4.2 Generic Trigger Helper for other tables
CREATE OR REPLACE FUNCTION public.fn_trigger_mission_automation()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.rpc_apply_mission_events(now() - interval '2 minutes', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recurring Subscriptions
DROP TRIGGER IF EXISTS tr_subscription_auto_mission ON public.recurring_subscriptions;
CREATE TRIGGER tr_subscription_auto_mission
AFTER INSERT ON public.recurring_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_mission_automation();

-- Anchor Commitments (Active only)
CREATE OR REPLACE FUNCTION public.fn_on_anchor_commitment_auto_mission()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'active') OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status != 'active') THEN
        PERFORM public.rpc_apply_mission_events(now() - interval '2 minutes', now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_anchor_auto_mission ON public.anchor_commitments;
CREATE TRIGGER tr_anchor_auto_mission
AFTER INSERT OR UPDATE ON public.anchor_commitments
FOR EACH ROW EXECUTE FUNCTION public.fn_on_anchor_commitment_auto_mission();

-- Drop Point Promotions
DROP TRIGGER IF EXISTS tr_promotion_auto_mission ON public.drop_point_promotions;
CREATE TRIGGER tr_promotion_auto_mission
AFTER INSERT ON public.drop_point_promotions
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_mission_automation();

-- Receipts (Quality Push)
DROP TRIGGER IF EXISTS tr_receipt_auto_mission ON public.receipts;
CREATE TRIGGER tr_receipt_auto_mission
AFTER INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_mission_automation();

NOTIFY pgrst, 'reload schema';
 Jackson-is-zero.
