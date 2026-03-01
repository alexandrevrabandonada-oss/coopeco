-- Migration: A19 — Rituals & Comms Pack
-- Implementation of operational communication tables and RLS.

-- 1. Table: comm_templates
-- Stores predefined messages and formats for operational rituals.
CREATE TABLE IF NOT EXISTS public.comm_templates (
  slug TEXT PRIMARY KEY, -- next_window|recommended_point|weekly_bulletin|top_flags|missions
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  formats TEXT[] DEFAULT '{3x4,1x1}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table: comm_exports
-- Logs when an operator generates/shares a card or text.
CREATE TABLE IF NOT EXISTS public.comm_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- same as template slug
  format TEXT NOT NULL, -- 'text', '3x4', '1x1'
  payload_json JSONB NOT NULL, -- Sanitized aggregated data only. NO PII.
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indices
CREATE INDEX idx_comm_exports_neighborhood ON public.comm_exports(neighborhood_id, created_at DESC);
CREATE INDEX idx_comm_exports_kind ON public.comm_exports(kind);

-- 4. RLS Policies
ALTER TABLE public.comm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_exports ENABLE ROW LEVEL SECURITY;

-- comm_templates: Public SELECT where active=true; operator write
DROP POLICY IF EXISTS "Public can read active templates" ON public.comm_templates;
CREATE POLICY "Public can read active templates"
  ON public.comm_templates FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Operators can manage templates" ON public.comm_templates;
CREATE POLICY "Operators can manage templates"
  ON public.comm_templates FOR ALL
  TO authenticated
  USING (public.has_role(ARRAY['operator'::public.app_role]))
  WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- comm_exports: Operator SELECT/INSERT; public none
DROP POLICY IF EXISTS "Operators can manage exports" ON public.comm_exports;
CREATE POLICY "Operators can manage exports"
  ON public.comm_exports FOR ALL
  TO authenticated
  USING (public.has_role(ARRAY['operator'::public.app_role]))
  WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- 5. Seed default templates
INSERT INTO public.comm_templates (slug, title, body_md) VALUES
('next_window', 'Próxima Janela de Coleta', 'Olá! Nossa próxima coleta no {{neighborhood}} será {{date}} ({{window}}). Vamos bater a meta de {{target}} sacos? ♻️'),
('recommended_point', 'Energia Coletiva: Ponto ECO', 'O Ponto ECO {{point_name}} está precisando de movimento! Que tal levar seus recicláveis lá hoje? Fica na {{address}}. 📍'),
('weekly_bulletin', 'Boletim Semanal ECO', 'Confira o resumo da semana em {{neighborhood}}: {{total_receipts}} coletas realizadas e {{ok_rate}}% de qualidade! Parabéns comunidade! 👏'),
('top_flags', 'Top 3 Erros do Bairro', 'Atenção, {{neighborhood}}! Esta semana tivemos foco em: {{flags}}. Vamos melhorar a separação para garantir a reciclagem? ⚠️'),
('missions', 'Missões do Comum', 'Temos uma nova missão: {{mission_title}}! Faltam apenas {{remaining}} para completarmos o objetivo do bairro. Vamos juntos? 🚀')
ON CONFLICT (slug) DO NOTHING;

-- 6. Trigger for updated_at
DROP TRIGGER IF EXISTS tr_comm_templates_updated_at ON public.comm_templates;
CREATE TRIGGER tr_comm_templates_updated_at
BEFORE UPDATE ON public.comm_templates
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

NOTIFY pgrst, 'reload schema';
