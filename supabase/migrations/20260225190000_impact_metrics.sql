-- 1. IMPACT EVENTS (The "Truth" table for metrics)
CREATE TABLE IF NOT EXISTS public.impact_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    kind TEXT NOT NULL, -- receipt_created, mutirao_created, chamado_created
    neighborhood_id UUID REFERENCES public.neighborhoods(id) NOT NULL,
    partner_id UUID REFERENCES public.partners(id),
    receipt_id UUID REFERENCES public.receipts(id),
    weight INT DEFAULT 1 NOT NULL,
    meta JSONB,
    event_id UUID UNIQUE -- For idempotency (optional but recommended)
);

-- RLS for impact_events: Public can only SELECT aggregated/non-PII
ALTER TABLE public.impact_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Impact events are public" ON public.impact_events;
CREATE POLICY "Impact events are public" ON public.impact_events FOR SELECT USING (true);

-- 2. METRICS DAILY (Aggregated state)
CREATE TABLE IF NOT EXISTS public.metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day DATE NOT NULL,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) NOT NULL,
    partner_id UUID REFERENCES public.partners(id),
    receipts_count INT DEFAULT 0 NOT NULL,
    mutiroes_count INT DEFAULT 0 NOT NULL,
    chamados_count INT DEFAULT 0 NOT NULL,
    impact_score INT DEFAULT 0 NOT NULL
);

-- Workaround for nullable in PK: use a unique index for the composite
ALTER TABLE public.metrics_daily DROP CONSTRAINT IF EXISTS metrics_daily_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_daily_unique ON public.metrics_daily (day, neighborhood_id, (COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::uuid)));

ALTER TABLE public.metrics_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Metrics are public" ON public.metrics_daily;
CREATE POLICY "Metrics are public" ON public.metrics_daily FOR SELECT USING (true);

-- 3. TRIGGERS & FUNCTIONS

-- Function to handle impact event insertion and metric updates
CREATE OR REPLACE FUNCTION public.proc_handle_impact_event()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_id UUID;
BEGIN
    -- Update metrics_daily
    INSERT INTO public.metrics_daily (
        day, neighborhood_id, partner_id,
        receipts_count, mutiroes_count, chamados_count, impact_score
    )
    VALUES (
        CURRENT_DATE, 
        NEW.neighborhood_id, 
        NEW.partner_id,
        CASE WHEN NEW.kind = 'receipt_created' THEN 1 ELSE 0 END,
        CASE WHEN NEW.kind = 'mutirao_created' THEN 1 ELSE 0 END,
        CASE WHEN NEW.kind = 'chamado_created' THEN 1 ELSE 0 END,
        NEW.weight
    )
    ON CONFLICT (day, neighborhood_id, COALESCE(partner_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET
        receipts_count = metrics_daily.receipts_count + EXCLUDED.receipts_count,
        mutiroes_count = metrics_daily.mutiroes_count + EXCLUDED.mutiroes_count,
        chamados_count = metrics_daily.chamados_count + EXCLUDED.chamados_count,
        impact_score = metrics_daily.impact_score + EXCLUDED.impact_score;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_impact_event_metrics ON public.impact_events;
CREATE TRIGGER tr_impact_event_metrics
AFTER INSERT ON public.impact_events
FOR EACH ROW EXECUTE FUNCTION public.proc_handle_impact_event();

-- Trigger for Receipts
CREATE OR REPLACE FUNCTION public.on_receipt_created_impact()
RETURNS TRIGGER AS $$
DECLARE
    v_neighborhood_id UUID;
    v_partner_id UUID;
BEGIN
    -- Get neighborhood from pickup_request
    SELECT neighborhood_id INTO v_neighborhood_id 
    FROM public.pickup_requests 
    WHERE id = NEW.request_id;

    -- Get partner if linked
    SELECT partner_id INTO v_partner_id
    FROM public.partner_receipts
    WHERE receipt_id = NEW.id
    LIMIT 1;

    INSERT INTO public.impact_events (kind, neighborhood_id, partner_id, receipt_id, weight)
    VALUES ('receipt_created', v_neighborhood_id, v_partner_id, NEW.id, 10);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_receipt_impact ON public.receipts;
CREATE TRIGGER tr_receipt_impact
AFTER INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.on_receipt_created_impact();

-- Trigger for Posts (Mutirão/Chamado)
CREATE OR REPLACE FUNCTION public.on_post_created_impact()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.kind = 'mutirao' THEN
        INSERT INTO public.impact_events (kind, neighborhood_id, weight)
        VALUES ('mutirao_created', NEW.neighborhood_id, 8);
    ELSIF NEW.kind = 'chamado' THEN
        INSERT INTO public.impact_events (kind, neighborhood_id, weight)
        VALUES ('chamado_created', NEW.neighborhood_id, 3);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_post_impact ON public.posts;
CREATE TRIGGER tr_post_impact
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.on_post_created_impact();
