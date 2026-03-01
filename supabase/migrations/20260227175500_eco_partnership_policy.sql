-- Migration: A24-ECO — Política de Parcerias & Âncoras
-- Created: 2026-02-27

-- 1. Partnership Policy Table
CREATE TABLE IF NOT EXISTS public.eco_partner_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    principles_md TEXT NOT NULL,
    criteria_md TEXT NOT NULL,
    enforcement_md TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Partner Status Table
CREATE TABLE IF NOT EXISTS public.eco_partner_status (
    partner_id UUID PRIMARY KEY REFERENCES public.partners(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('candidate', 'partner', 'anchor', 'suspended', 'inactive')) DEFAULT 'candidate',
    tier TEXT CHECK (tier IN ('bronze', 'prata', 'ouro')),
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    notes_public TEXT, -- max 200
    notes_internal TEXT, -- max 300
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT partner_notes_public_length CHECK (char_length(notes_public) <= 200),
    CONSTRAINT partner_notes_internal_length CHECK (char_length(notes_internal) <= 300)
);

-- 3. RLS Policies
ALTER TABLE public.eco_partner_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_partner_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read partner policy" ON public.eco_partner_policy FOR SELECT USING (true);
CREATE POLICY "Operators manage partner policy" ON public.eco_partner_policy FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

CREATE POLICY "Public read partner status summary" ON public.eco_partner_status FOR SELECT USING (true);
CREATE POLICY "Operators view internal notes" ON public.eco_partner_status FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));
CREATE POLICY "Operators manage partner status" ON public.eco_partner_status FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')));

-- 4. Partner Metrics View (Aggregated 30d)
-- Assumes receipts are linked to partners via drop_points or directly
CREATE OR REPLACE VIEW public.v_partner_metrics_30d AS
SELECT 
    p.id as partner_id,
    p.name as partner_name,
    COUNT(r.id) as receipts_count_30d,
    AVG(CASE WHEN r.status = 'collected' THEN 1 ELSE 0 END) as ok_rate_30d, -- Simplified quality check
    MAX(r.created_at) as last_activity,
    EXTRACT(DAY FROM (now() - MAX(r.created_at))) as inactivity_days
FROM public.partners p
LEFT JOIN public.eco_drop_points dp ON dp.partner_id = p.id
LEFT JOIN public.pickup_requests r ON r.drop_point_id = dp.id AND r.created_at >= now() - interval '30 days'
GROUP BY p.id, p.name;

-- 5. Partner Recommendations View
CREATE OR REPLACE VIEW public.v_partner_recommendations AS
SELECT 
    m.*,
    s.status as current_status,
    CASE 
        WHEN m.ok_rate_30d < 0.7 AND m.receipts_count_30d > 5 THEN 'quality_coaching'
        WHEN m.inactivity_days > 14 THEN 'mark_inactive'
        WHEN s.status = 'anchor' AND (m.receipts_count_30d < 2 OR m.ok_rate_30d < 0.8) THEN 'Review Anchor Status (Consistência Baixa)'
        WHEN s.status = 'candidate' AND m.receipts_count_30d > 10 AND m.ok_rate_30d > 0.9 THEN 'promote_to_partner'
        ELSE 'keep_current'
    END as recommendation
FROM public.v_partner_metrics_30d m
LEFT JOIN public.eco_partner_status s ON s.partner_id = m.partner_id;

-- 6. Trigger for updated_at in partner_status
CREATE TRIGGER set_partner_status_updated_at
    BEFORE UPDATE ON public.eco_partner_status
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. Seeding Initial Policy
INSERT INTO public.eco_partner_policy (version, title, principles_md, criteria_md, enforcement_md) VALUES
('v1.0', 'Política de Parceria COOP ECO', 
'# Princípios\n- Trabalho Digno: O parceiro respeita a autonomia do cooperado.\n- Anti-Greenwashing: Status é conquistado por dados, não por marketing.\n- Transparência: Dados de impacto são públicos.',
'# Critérios\n- **Parceiro**: Realiza coletas semanais com >90% de qualidade.\n- **Âncora**: Ponto de referência, alta frequência e engajamento comunitário.',
'# Consequências\n- Inatividade >15 dias: Status Inativo.\n- Falhas recorrentes: Suspensão para reavaliação.')
ON CONFLICT (version) DO NOTHING;

-- 8. RPC for Status Review
CREATE OR REPLACE FUNCTION public.rpc_review_partner_status(p_partner_id UUID, p_action TEXT, p_tier TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_new_status TEXT;
BEGIN
    -- Authorization Check
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin')) THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    CASE p_action
        WHEN 'promote_candidate_to_partner' THEN v_new_status := 'partner';
        WHEN 'promote_partner_to_anchor' THEN v_new_status := 'anchor';
        WHEN 'suspend_partner' THEN v_new_status := 'suspended';
        WHEN 'reactivate_partner' THEN v_new_status := 'partner';
        ELSE RAISE EXCEPTION 'Ação inválida';
    END CASE;

    INSERT INTO public.eco_partner_status (partner_id, status, tier, last_reviewed_at, reviewed_by)
    VALUES (p_partner_id, v_new_status, p_tier, now(), auth.uid())
    ON CONFLICT (partner_id) DO UPDATE 
    SET status = EXCLUDED.status,
        tier = COALESCE(p_tier, public.eco_partner_status.tier),
        last_reviewed_at = EXCLUDED.last_reviewed_at,
        reviewed_by = EXCLUDED.reviewed_by;
        
    -- Audit Logging
    INSERT INTO public.admin_audit_log (action, metadata)
    VALUES ('partner_status_changed', jsonb_build_object('partner_id', p_partner_id, 'new_status', v_new_status, 'tier', p_tier));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
