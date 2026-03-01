-- Migration: A44 — Templates de Comunicação por Célula
-- supabase/migrations/20260318000000_eco_cell_comms_templates.sql

-- 1. Create eco_comms_templates table
CREATE TABLE IF NOT EXISTS public.eco_comms_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scope text NOT NULL CHECK (scope IN ('global', 'cell', 'neighborhood')),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    kind text NOT NULL, -- next_window_text, recommended_point_text, etc.
    title text NOT NULL, -- limit 80 in app logic
    body_md text NOT NULL, -- limit 800 in app logic
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Constraint to prevent duplicates in same scope/entity/kind
    CONSTRAINT unique_template_scope UNIQUE (scope, cell_id, neighborhood_id, kind)
);

-- Note: In PostgreSQL, UNIQUE constraints treat NULL as distinct. 
-- For more robust unique handling across nullable columns, we use a unique index:
CREATE UNIQUE INDEX idx_unique_template_scoped 
ON public.eco_comms_templates (kind) 
WHERE scope = 'global';

CREATE UNIQUE INDEX idx_unique_template_cell 
ON public.eco_comms_templates (cell_id, kind) 
WHERE scope = 'cell';

CREATE UNIQUE INDEX idx_unique_template_neighborhood 
ON public.eco_comms_templates (neighborhood_id, kind) 
WHERE scope = 'neighborhood';

-- 2. RLS Policies
ALTER TABLE public.eco_comms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all templates" 
ON public.eco_comms_templates FOR ALL TO authenticated 
USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- 3. v_effective_comms_template: Fallback resolution
-- Order: neighborhood > cell > global
CREATE OR REPLACE VIEW public.v_effective_comms_template AS
WITH ranked_templates AS (
    SELECT 
        t.kind,
        n.id as neighborhood_id,
        n.cell_id,
        t.title,
        t.body_md,
        t.scope,
        ROW_NUMBER() OVER (
            PARTITION BY n.id, t.kind 
            ORDER BY 
                CASE 
                    WHEN t.scope = 'neighborhood' AND t.neighborhood_id = n.id THEN 1
                    WHEN t.scope = 'cell' AND t.cell_id = n.cell_id THEN 2
                    WHEN t.scope = 'global' THEN 3
                    ELSE 99
                END ASC
        ) as rank
    FROM public.neighborhoods n
    CROSS JOIN public.eco_comms_templates t
    WHERE t.is_active = true
      AND (
          (t.scope = 'neighborhood' AND t.neighborhood_id = n.id) OR
          (t.scope = 'cell' AND t.cell_id = n.cell_id) OR
          (t.scope = 'global')
      )
)
SELECT 
    neighborhood_id,
    cell_id,
    kind,
    title,
    body_md,
    scope as effectively_used_scope
FROM ranked_templates
WHERE rank = 1;

-- 4. Migration from old comm_templates to global scope
INSERT INTO public.eco_comms_templates (scope, kind, title, body_md)
SELECT 
    'global',
    CASE 
        WHEN slug = 'next_window' THEN 'next_window_text'
        WHEN slug = 'recommended_point' THEN 'recommended_point_text'
        WHEN slug = 'weekly_bulletin' THEN 'weekly_bulletin_text'
        WHEN slug = 'top_flags' THEN 'top_flags_text'
        WHEN slug = 'missions' THEN 'missions_text'
        ELSE slug || '_text'
    END,
    title,
    body_md
FROM public.comm_templates
ON CONFLICT DO NOTHING;

-- Seed missing A44 specific kinds
INSERT INTO public.eco_comms_templates (scope, kind, title, body_md)
VALUES 
    ('global', 'learning_focus_week_text', 'Foco da Semana: {{neighborhood}}', 'Esta semana nosso foco no ECO é: {{focus_title}}. {{focus_summary}}. Vamos juntos? 📚'),
    ('global', 'runbook_notice_text', 'Aviso de Operação', 'Informamos que {{neighborhood}} está em operação {{status}}. {{notice_text}}. 👷'),
    ('global', 'invite_text', 'Convite ECO: Entre para o Comum', 'Ei! Você recebeu um convite para participar do ECO em {{neighborhood}}. Junte-se ao coletivo para cuidar do nosso território: {{cta_url}} 🤝')
ON CONFLICT DO NOTHING;

-- 5. Set updated_at trigger
CREATE TRIGGER tr_eco_comms_templates_updated_at
BEFORE UPDATE ON public.eco_comms_templates
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

NOTIFY pgrst, 'reload schema';
