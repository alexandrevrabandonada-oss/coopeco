-- A34 — Auditoria Final de Privacidade (Anti-vazamento)
-- supabase/migrations/20260309000000_eco_privacy_audit.sql

-- A) eco_privacy_rules
CREATE TABLE IF NOT EXISTS public.eco_privacy_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_key text NOT NULL UNIQUE,
    description text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('warn', 'blocker')),
    applies_to text[] NOT NULL, -- {feeds, prints, obs, bulletins, zones, feedback}
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- B) eco_privacy_audit_runs
CREATE TABLE IF NOT EXISTS public.eco_privacy_audit_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    scope text NOT NULL CHECK (scope IN ('global', 'cell', 'neighborhood')),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    result_status text NOT NULL CHECK (result_status IN ('pass', 'fail', 'warning')),
    results jsonb NOT NULL, -- {details: [{rule_key, status, matches_count, sample_leaks}]}
    
    CONSTRAINT ck_audit_ids CHECK (
        (scope = 'global' AND cell_id IS NULL AND neighborhood_id IS NULL) OR
        (scope = 'cell' AND cell_id IS NOT NULL AND neighborhood_id IS NULL) OR
        (scope = 'neighborhood' AND neighborhood_id IS NOT NULL AND cell_id IS NULL)
    )
);

-- RLS
ALTER TABLE public.eco_privacy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_privacy_audit_runs ENABLE ROW LEVEL SECURITY;

-- Rules: Everyone (authenticated) can read, only operators can manage
CREATE POLICY "Public read privacy rules" ON public.eco_privacy_rules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators manage privacy rules" ON public.eco_privacy_rules
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));

-- Audit Runs: Only operators
CREATE POLICY "Operators manage privacy audits" ON public.eco_privacy_audit_runs
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator'));

-- Seed default rules
INSERT INTO public.eco_privacy_rules (rule_key, description, severity, applies_to)
VALUES 
    ('no_private_address_in_public', 'Proibir endereços completos (rua/número) em feeds públicos.', 'blocker', ARRAY['feeds', 'bulletins', 'prints']),
    ('no_phone_email_in_logs', 'Redigir telefones e emails em logs de observabilidade e metadados.', 'blocker', ARRAY['obs', 'feedback']),
    ('k_anonymity_zones_k5', 'Garantir que heatmaps de zona tenham no mínimo 5 requisições para exibir.', 'warn', ARRAY['zones']),
    ('no_pii_in_share_cards', 'Mascara nomes e identificadores em imagens de compartilhamento social.', 'blocker', ARRAY['prints']),
    ('no_pii_in_bulletins', 'Certificar que boletins automáticos não incluam nomes de moradores.', 'blocker', ARRAY['bulletins'])
ON CONFLICT (rule_key) DO UPDATE SET 
    description = EXCLUDED.description,
    severity = EXCLUDED.severity,
    applies_to = EXCLUDED.applies_to;
