-- Migration: A56 - UX Readiness Checklist
-- Description: Criação da tabela para auditar os 12 pontos essenciais de UX antes do lançamento.

CREATE TABLE IF NOT EXISTS public.eco_ux_readiness_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL CHECK (char_length(item_key) <= 100),
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done')),
    notes TEXT CHECK (char_length(notes) <= 500),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(cell_id, item_key)
);

CREATE OR REPLACE FUNCTION update_eco_ux_readiness_items_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW()); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER tr_eco_ux_readiness_items_updated_at 
BEFORE UPDATE ON public.eco_ux_readiness_items 
FOR EACH ROW EXECUTE FUNCTION update_eco_ux_readiness_items_updated_at();

ALTER TABLE public.eco_ux_readiness_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura dos itens de ux pelo operador da célula" 
ON public.eco_ux_readiness_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.eco_mandates m WHERE m.user_id = auth.uid() AND m.cell_id = eco_ux_readiness_items.cell_id AND m.status = 'active')
);

CREATE POLICY "Alteração dos itens de ux pelo operador da célula" 
ON public.eco_ux_readiness_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.eco_mandates m WHERE m.user_id = auth.uid() AND m.cell_id = eco_ux_readiness_items.cell_id AND m.status = 'active')
);

-- Seed initial items for existing cells
DO $$
DECLARE
    v_cell RECORD;
    v_keys TEXT[] := ARRAY[
        'onboarding_60s', 'launch_blocked_ctas', 'pickup_alternatives', 
        'drop_point_instructions', 'neighborhood_week_cta', 'collective_wins_accessible',
        'open_data_privacy_notice', 'runbook_actionable', 'offline_lite_banner',
        'logistics_replenish', 'partners_no_greenwashing', 'ramp_reason_human'
    ];
    v_key TEXT;
BEGIN
    FOR v_cell IN SELECT id FROM public.eco_cells LOOP
        FOREACH v_key IN ARRAY v_keys LOOP
            INSERT INTO public.eco_ux_readiness_items (cell_id, item_key) 
            VALUES (v_cell.id, v_key)
            ON CONFLICT (cell_id, item_key) DO NOTHING;
        END LOOP;
    END LOOP;
END;
$$;
