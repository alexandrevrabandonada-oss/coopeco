-- Migration: A30 — Integrações Externas Mínimas
-- Adiciona suporte a feeds públicos (ICS/JSON) e webhooks para alertas críticos.

-- A) eco_public_feeds (Feeds Públicos Sanitizados)
CREATE TABLE IF NOT EXISTS public.eco_public_feeds (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scope text NOT NULL CHECK (scope IN ('cell', 'neighborhood')),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    feed_kind text NOT NULL CHECK (feed_kind IN ('windows_ics', 'bulletins_json', 'transparency_json')),
    is_enabled boolean DEFAULT true,
    public_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(scope, cell_id, neighborhood_id, feed_kind)
);

ALTER TABLE public.eco_public_feeds ENABLE ROW LEVEL SECURITY;

-- Only operators/moderators can view/manage feed settings
CREATE POLICY "Operator/Moderator manage feeds" ON public.eco_public_feeds
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- B) eco_webhook_endpoints (Webhooks de Operação)
CREATE TABLE IF NOT EXISTS public.eco_webhook_endpoints (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    enabled boolean DEFAULT false,
    url text NOT NULL,
    secret text DEFAULT encode(gen_random_bytes(32), 'hex'), -- Para assinatura HMAC
    event_kinds text[] DEFAULT '{ops_alert_critical}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operator/Moderator manage webhooks" ON public.eco_webhook_endpoints
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- Index for public feed lookup (The actual API route will query this using the token)
CREATE INDEX IF NOT EXISTS idx_public_feeds_token ON public.eco_public_feeds(public_token);

-- C) Update Health Dashboard (Sanity Checklist for Integrations)
-- No table changes needed here, we'll use queries in the UI.

-- D) Audit Log Trigger
-- Ensure webhook changes are logged
CREATE OR REPLACE FUNCTION public.fn_audit_webhook_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.admin_audit_log (operator_id, action, target_type, target_id, details)
    VALUES (
        auth.uid(), 
        TG_OP || '_webhook', 
        'eco_webhook_endpoint', 
        COALESCE(NEW.id, OLD.id), 
        jsonb_build_object('url', COALESCE(NEW.url, 'deleted'), 'enabled', COALESCE(NEW.enabled, false))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_audit_webhook_changes
AFTER INSERT OR UPDATE OR DELETE ON public.eco_webhook_endpoints
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_webhook_changes();
