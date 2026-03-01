-- Migration: A25 — Go-Live Hardening (Invariantes, Saúde, Checklist)
-- Date: 2026-02-27

-- 1. Invariantes do Sistema
CREATE TABLE IF NOT EXISTS public.eco_system_invariants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    description text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('warn', 'blocker')),
    is_enforced boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS for Invariantes
ALTER TABLE public.eco_system_invariants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for invariants" ON public.eco_system_invariants FOR SELECT USING (true);
CREATE POLICY "Operator write for invariants" ON public.eco_system_invariants ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator')
);

-- 2. Snapshots de Saúde
CREATE TABLE IF NOT EXISTS public.eco_health_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    neighborhood_id uuid REFERENCES public.neighborhoods(id),
    summary jsonb NOT NULL,
    created_by uuid REFERENCES auth.users(id)
);

-- RLS for Health Snapshots
ALTER TABLE public.eco_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operator read/write for health snapshots" ON public.eco_health_snapshots ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator')
);

-- 3. Checklist Go-Live
CREATE TABLE IF NOT EXISTS public.eco_go_live_checklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id uuid REFERENCES public.neighborhoods(id) UNIQUE,
    version text NOT NULL DEFAULT 'v1',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eco_go_live_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id uuid REFERENCES public.eco_go_live_checklist(id) ON DELETE CASCADE,
    item_key text NOT NULL,
    title text NOT NULL,
    status text NOT NULL CHECK (status IN ('todo', 'done', 'blocked')),
    notes text, -- Sanitized notes <= 200 chars
    completed_at timestamptz,
    UNIQUE(checklist_id, item_key)
);

-- RLS for Checklist
ALTER TABLE public.eco_go_live_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_go_live_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operator access for checklist" ON public.eco_go_live_checklist ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator')
);

CREATE POLICY "Operator access for checklist items" ON public.eco_go_live_items ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'operator')
);

-- Trigger for updated_at on invariants
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_eco_system_invariants_updated_at
    BEFORE UPDATE ON public.eco_system_invariants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed Invariants
INSERT INTO public.eco_system_invariants (key, description, severity) VALUES
('no_pii_exports', 'Garantir que exportações de imagem/texto não contenham PII brute-force.', 'blocker'),
('receipt_idempotent', 'Impedir recibos duplicados para o mesmo chamado/janela.', 'blocker'),
('window_capacity_respected', 'Aviso se a capacidade da janela for excedida em > 20%.', 'warn'),
('k_anonymity_zones', 'Garantir que métricas públicas agreguem pelo menos 3 pontos de dados.', 'blocker'),
('partner_policy_public', 'Exigir que a Política de Parcerias esteja publicada para aceitar Âncoras.', 'blocker')
ON CONFLICT (key) DO NOTHING;

-- Initial Go-Live item definitions will be handled via RPC or API during initialization.
