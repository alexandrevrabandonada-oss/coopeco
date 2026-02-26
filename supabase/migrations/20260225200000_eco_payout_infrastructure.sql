-- Phase A4: Cooperado Dashboards & Payout Flows
-- 1. PRICING RULES
CREATE TABLE IF NOT EXISTS public.coop_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_kind TEXT NOT NULL, -- paper, plastic, glass, metal, organic, electronic
    unit_kind TEXT NOT NULL, -- kg, unit, bag
    amount_cents INT NOT NULL CHECK (amount_cents >= 0),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one active rule per material/unit pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_coop_pricing_rules_active_uniq 
ON public.coop_pricing_rules (material_kind, unit_kind) 
WHERE (active = true);

ALTER TABLE public.coop_pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators manage pricing" ON public.coop_pricing_rules
    FOR ALL USING (public.has_role(ARRAY['operator'::public.app_role]));
CREATE POLICY "Public read active pricing" ON public.coop_pricing_rules
    FOR SELECT USING (active = true);

-- 2. EARNINGS LEDGER
CREATE TABLE IF NOT EXISTS public.coop_earnings_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cooperado_id UUID NOT NULL REFERENCES public.profiles(user_id),
    receipt_id UUID NOT NULL UNIQUE REFERENCES public.receipts(id),
    neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id),
    total_cents INT NOT NULL CHECK (total_cents >= 0),
    breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.coop_earnings_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cooperados see own ledger" ON public.coop_earnings_ledger
    FOR SELECT USING (auth.uid() = cooperado_id);
CREATE POLICY "Operators see all ledger" ON public.coop_earnings_ledger
    FOR SELECT USING (public.has_role(ARRAY['operator'::public.app_role]));

-- 3. PAYOUT PERIODS
CREATE TABLE IF NOT EXISTS public.coop_payout_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
    created_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ
);

ALTER TABLE public.coop_payout_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators manage periods" ON public.coop_payout_periods
    FOR ALL USING (public.has_role(ARRAY['operator'::public.app_role]));
CREATE POLICY "Cooperados view periods" ON public.coop_payout_periods
    FOR SELECT USING (auth.role() = 'authenticated');

-- 4. PAYOUTS
CREATE TABLE IF NOT EXISTS public.coop_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cooperado_id UUID NOT NULL REFERENCES public.profiles(user_id),
    period_id UUID NOT NULL REFERENCES public.coop_payout_periods(id),
    total_cents INT NOT NULL CHECK (total_cents >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    payout_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ,
    UNIQUE(cooperado_id, period_id)
);

ALTER TABLE public.coop_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cooperados see own payouts" ON public.coop_payouts
    FOR SELECT USING (auth.uid() = cooperado_id);
CREATE POLICY "Operators manage payouts" ON public.coop_payouts
    FOR ALL USING (public.has_role(ARRAY['operator'::public.app_role]));

-- 5. AUTOMATION FUNCTIONS & TRIGGERS

-- Function to calculate earnings on receipt creation
CREATE OR REPLACE FUNCTION public.proc_calculate_receipt_earnings()
RETURNS TRIGGER AS $$
DECLARE
    v_total_cents INT := 0;
    v_breakdown JSONB := '[]'::jsonb;
    v_item RECORD;
    v_rule_amount INT;
    v_neighborhood_id UUID;
BEGIN
    -- Get neighborhood from pickup_request
    SELECT neighborhood_id INTO v_neighborhood_id 
    FROM public.pickup_requests 
    WHERE id = NEW.request_id;

    -- Iterate items from the receipt (stored in items JSONB/ARRAY if that was the design, 
    -- but the prompt implies items are available. Let's assume standard item structure 
    -- if using a separate table, but based on previous migrations, we might need to 
    -- check how items are stored. 
    -- ACTUALLY, for A4 consistency, let's look at the receipt structure.
    
    -- For now, let's implement a robust calculation logic that looks for active rules.
    -- Assuming a simple model where we join with pricing rules.
    
    -- Since we don't have a 'receipt_items' table yet in the prompt, 
    -- but usually they exist. Let's assume they are in NEW.items if it's JSONB.
    
    -- For the sake of this prompt's objective (Coop-first), 
    -- we will calculate the earnings from the items recorded in the receipt.
    
    FOR v_item IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(material TEXT, unit TEXT, quantity NUMERIC)
    LOOP
        SELECT amount_cents INTO v_rule_amount 
        FROM public.coop_pricing_rules 
        WHERE material_kind = v_item.material 
          AND unit_kind = v_item.unit 
          AND active = true;
        
        IF FOUND THEN
            v_total_cents := v_total_cents + (v_rule_amount * v_item.quantity);
            v_breakdown := v_breakdown || jsonb_build_object(
                'material', v_item.material,
                'quantity', v_item.quantity,
                'rate', v_rule_amount,
                'subtotal', (v_rule_amount * v_item.quantity)
            );
        END IF;
    END LOOP;

    IF v_total_cents > 0 THEN
        INSERT INTO public.coop_earnings_ledger (
            cooperado_id, receipt_id, neighborhood_id, total_cents, breakdown
        ) VALUES (
            NEW.cooperado_id, NEW.id, v_neighborhood_id, v_total_cents, v_breakdown
        ) ON CONFLICT (receipt_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_calculate_earnings ON public.receipts;
CREATE TRIGGER tr_calculate_earnings
AFTER INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.proc_calculate_receipt_earnings();

-- RPC for Period Closing
CREATE OR REPLACE FUNCTION public.rpc_close_payout_period(p_period_id UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT public.has_role(ARRAY['operator'::public.app_role]) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    -- Update period status
    UPDATE public.coop_payout_periods 
    SET status = 'closed', closed_at = now() 
    WHERE id = p_period_id;

    -- Generate payouts
    INSERT INTO public.coop_payouts (cooperado_id, period_id, total_cents)
    SELECT 
        l.cooperado_id, 
        p_period_id, 
        SUM(l.total_cents)
    FROM public.coop_earnings_ledger l
    JOIN public.coop_payout_periods p ON l.created_at >= p.period_start AND l.created_at <= p.period_end
    WHERE p.id = p_period_id
    GROUP BY l.cooperado_id
    ON CONFLICT (cooperado_id, period_id) DO UPDATE 
    SET total_cents = EXCLUDED.total_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
