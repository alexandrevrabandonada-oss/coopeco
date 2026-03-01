-- Migration: A55 - Recompensa Coletiva (Bairro/Ponto)
-- Description: Criação do ledger de pontos coletivos, catálogo de trocas do comum e automação via triggers.

-- 1. eco_reward_rules (Configuração Global de Pontuação)
CREATE TABLE IF NOT EXISTS public.eco_reward_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT UNIQUE NOT NULL,
    rules_md TEXT,
    points_per_receipt_ok INT NOT NULL DEFAULT 3,
    points_per_receipt_attention INT NOT NULL DEFAULT 1,
    points_penalty_contaminated INT NOT NULL DEFAULT -2,
    points_per_task_done INT NOT NULL DEFAULT 2,
    points_bonus_anchor_week INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Inserir regras padrão v1.0
INSERT INTO public.eco_reward_rules (version, rules_md) VALUES (
    'v1.0', 
    'A pontuação coletiva reflete o cuidado com o comum. Recebimentos Perfeitos geram 3pts, Atenção 1pt e Contaminados retiram 2pts. Tarefas do comum concluídas somam 2pts diretos ao bairro. Parceiros âncora ativos pontuam bônus semanais.'
) ON CONFLICT (version) DO NOTHING;

ALTER TABLE public.eco_reward_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de regras" ON public.eco_reward_rules FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Apenas admin altera regras" ON public.eco_reward_rules FOR ALL USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'));

-- 2. eco_collective_points_ledger (Livro-Razão Imutável)
CREATE TABLE IF NOT EXISTS public.eco_collective_points_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope TEXT NOT NULL CHECK (scope IN ('neighborhood', 'drop_point', 'cell')),
    cell_id UUID REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    drop_point_id UUID REFERENCES public.eco_drop_points(id) ON DELETE CASCADE,
    event_kind TEXT NOT NULL CHECK (event_kind IN ('receipt_ok', 'receipt_attention', 'receipt_contaminated', 'task_done', 'anchor_week', 'bonus', 'manual_adjust', 'redemption')),
    points_delta INT NOT NULL,
    ref_kind TEXT CHECK (ref_kind IN ('receipt', 'task', 'campaign', 'redemption', 'other')),
    ref_id UUID,
    notes TEXT CHECK (char_length(notes) <= 120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) -- Opcional, para ajustes manuais ou auditoria
);

CREATE INDEX idx_ledger_aggs ON public.eco_collective_points_ledger(scope, neighborhood_id, drop_point_id, created_at);

ALTER TABLE public.eco_collective_points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso negado para anon e auth (via API REST REST)" ON public.eco_collective_points_ledger FOR SELECT TO PUBLIC USING (false);
-- view lida com leitura pública agregada. Inserções manuais via RPC.
CREATE POLICY "Operadores podem ver ledger de sua célula" ON public.eco_collective_points_ledger FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.eco_mandates m WHERE m.user_id = auth.uid() AND m.cell_id = eco_collective_points_ledger.cell_id AND m.status = 'active')
);
CREATE POLICY "Admins têm acesso total" ON public.eco_collective_points_ledger FOR ALL USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'));

-- 3. v_collective_points_balance (View Pública Agregada)
CREATE OR REPLACE VIEW public.v_collective_points_balance AS
SELECT 
    scope,
    cell_id,
    neighborhood_id,
    drop_point_id,
    SUM(points_delta) AS points_balance,
    SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN points_delta ELSE 0 END) AS last_30d_delta,
    MAX(created_at) AS updated_at
FROM public.eco_collective_points_ledger
GROUP BY scope, cell_id, neighborhood_id, drop_point_id;

-- 4. eco_reward_catalog (Trocas do Comum)
CREATE TABLE IF NOT EXISTS public.eco_reward_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope TEXT NOT NULL CHECK (scope IN ('neighborhood', 'drop_point', 'cell')),
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    drop_point_id UUID REFERENCES public.eco_drop_points(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) <= 120),
    description_md TEXT CHECK (char_length(description_md) <= 800),
    cost_points INT NOT NULL CHECK (cost_points > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    needs_governance BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE OR REPLACE FUNCTION update_eco_reward_catalog_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW()); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER tr_eco_reward_catalog_updated_at BEFORE UPDATE ON public.eco_reward_catalog FOR EACH ROW EXECUTE FUNCTION update_eco_reward_catalog_updated_at();

ALTER TABLE public.eco_reward_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública itens ativos" ON public.eco_reward_catalog FOR SELECT USING (status = 'active');
CREATE POLICY "Operadores podem gerir catálogo da célula" ON public.eco_reward_catalog FOR ALL USING (
    EXISTS (SELECT 1 FROM public.eco_mandates m WHERE m.user_id = auth.uid() AND m.cell_id = eco_reward_catalog.cell_id AND m.status = 'active')
);

-- 5. eco_reward_redemptions (Resgates Coletivos)
CREATE TABLE IF NOT EXISTS public.eco_reward_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalog_id UUID NOT NULL REFERENCES public.eco_reward_catalog(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    drop_point_id UUID REFERENCES public.eco_drop_points(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'fulfilled')),
    decision_receipt_id UUID REFERENCES public.eco_cell_decision_receipts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE OR REPLACE FUNCTION update_eco_reward_redemptions_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW()); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER tr_eco_reward_redemptions_updated_at BEFORE UPDATE ON public.eco_reward_redemptions FOR EACH ROW EXECUTE FUNCTION update_eco_reward_redemptions_updated_at();

ALTER TABLE public.eco_reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operadores podem ver/editar resgates da célula" ON public.eco_reward_redemptions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.eco_mandates m WHERE m.user_id = auth.uid() AND m.cell_id = eco_reward_redemptions.cell_id AND m.status = 'active')
);
CREATE POLICY "Admins têm acesso total resgates" ON public.eco_reward_redemptions FOR ALL USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'));


-- ==========================================
-- AUTOMAÇÃO VIA TRIGGERS (SECURITY DEFINER)
-- ==========================================

-- TRIGGER: Recibos (A8/A10) gerando pontos coletivos
CREATE OR REPLACE FUNCTION public.fn_trigger_points_on_receipt_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rules public.eco_reward_rules;
    v_delta INT := 0;
    v_event_kind TEXT;
BEGIN
    -- Só age quando transita para status final que pontue e passa a ter qualidade
    IF (NEW.status = 'ok' OR NEW.status = 'attention' OR NEW.status = 'contaminated') 
       AND (OLD.status IS NULL OR OLD.status NOT IN ('ok', 'attention', 'contaminated')) THEN
        
        -- Carrega regras atuais
        SELECT * INTO v_rules FROM public.eco_reward_rules ORDER BY created_at DESC LIMIT 1;
        
        IF NEW.status = 'ok' THEN 
            v_delta := v_rules.points_per_receipt_ok; 
            v_event_kind := 'receipt_ok';
        ELSIF NEW.status = 'attention' THEN 
            v_delta := v_rules.points_per_receipt_attention; 
            v_event_kind := 'receipt_attention';
        ELSIF NEW.status = 'contaminated' THEN 
            v_delta := v_rules.points_penalty_contaminated; 
            v_event_kind := 'receipt_contaminated';
        END IF;

        IF v_delta != 0 THEN
            -- Pontua Bairro
            IF NEW.neighborhood_id IS NOT NULL THEN
                INSERT INTO public.eco_collective_points_ledger 
                    (scope, cell_id, neighborhood_id, drop_point_id, event_kind, points_delta, ref_kind, ref_id)
                VALUES 
                    ('neighborhood', NEW.cell_id, NEW.neighborhood_id, NULL, v_event_kind, v_delta, 'receipt', NEW.id);
            END IF;
            -- Pontua Drop Point (se houver)
            IF NEW.drop_point_id IS NOT NULL THEN
                INSERT INTO public.eco_collective_points_ledger 
                    (scope, cell_id, neighborhood_id, drop_point_id, event_kind, points_delta, ref_kind, ref_id)
                VALUES 
                    ('drop_point', NEW.cell_id, NEW.neighborhood_id, NEW.drop_point_id, v_event_kind, v_delta, 'receipt', NEW.id);
            END IF;
            -- Pontua Célula como um todo (Rollup invisível)
            INSERT INTO public.eco_collective_points_ledger 
                (scope, cell_id, neighborhood_id, drop_point_id, event_kind, points_delta, ref_kind, ref_id)
            VALUES 
                ('cell', NEW.cell_id, NULL, NULL, v_event_kind, v_delta, 'receipt', NEW.id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Usando a tabela de receipts gerada previamente (assumindo nome da sprint passada)
-- Se a tabela de recibos for receipts (simplificado):
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'receipts') THEN
    CREATE TRIGGER tr_points_on_receipt_finalized
    AFTER UPDATE OF status ON public.receipts
    FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_points_on_receipt_finalized();
  END IF;
END $$;


-- TRIGGER: Tarefas do Comum (A50) gerando pontos
CREATE OR REPLACE FUNCTION public.fn_trigger_points_on_task_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rules public.eco_reward_rules;
BEGIN
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        SELECT * INTO v_rules FROM public.eco_reward_rules ORDER BY created_at DESC LIMIT 1;
        
        IF NEW.neighborhood_id IS NOT NULL THEN
            INSERT INTO public.eco_collective_points_ledger 
                (scope, cell_id, neighborhood_id, event_kind, points_delta, ref_kind, ref_id)
            VALUES 
                ('neighborhood', NEW.cell_id, NEW.neighborhood_id, 'task_done', v_rules.points_per_task_done, 'task', NEW.id);
        ELSE
            INSERT INTO public.eco_collective_points_ledger 
                (scope, cell_id, event_kind, points_delta, ref_kind, ref_id)
            VALUES 
                ('cell', NEW.cell_id, 'task_done', v_rules.points_per_task_done, 'task', NEW.id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'eco_common_tasks') THEN
    CREATE TRIGGER tr_points_on_task_done
    AFTER UPDATE OF status ON public.eco_common_tasks
    FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_points_on_task_done();
  END IF;
END $$;


-- RPC: Bônus Semanal para Âncoras Ativas (A24 -> A55)
CREATE OR REPLACE FUNCTION public.rpc_apply_anchor_week_bonus(p_cell_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rules public.eco_reward_rules;
    v_anchor RECORD;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.eco_mandates WHERE user_id = auth.uid() AND cell_id = p_cell_id AND status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'
    ) THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    SELECT * INTO v_rules FROM public.eco_reward_rules ORDER BY created_at DESC LIMIT 1;

    FOR v_anchor IN (
        SELECT id, neighborhood_id FROM public.eco_cell_anchors 
        WHERE cell_id = p_cell_id AND status = 'active'
    ) LOOP
        -- Insere bônus para o bairro da âncora
        IF v_anchor.neighborhood_id IS NOT NULL THEN
            INSERT INTO public.eco_collective_points_ledger 
                (scope, cell_id, neighborhood_id, event_kind, points_delta, notes)
            VALUES 
                ('neighborhood', p_cell_id, v_anchor.neighborhood_id, 'anchor_week', v_rules.points_bonus_anchor_week, 'Bônus Parceria Âncora');
        END IF;
    END LOOP;
END;
$$;

-- RPC: Ajuste Manual (Moderador/Admin)
CREATE OR REPLACE FUNCTION public.rpc_manual_adjust_points(
    p_cell_id UUID,
    p_scope TEXT,
    p_neighborhood_id UUID,
    p_drop_point_id UUID,
    p_delta INT,
    p_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.eco_mandates WHERE user_id = auth.uid() AND cell_id = p_cell_id AND status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'
    ) THEN
        RAISE EXCEPTION 'Acesso negado para ajustes manuais.';
    END IF;

    INSERT INTO public.eco_collective_points_ledger 
        (scope, cell_id, neighborhood_id, drop_point_id, event_kind, points_delta, notes, created_by)
    VALUES 
        (p_scope, p_cell_id, p_neighborhood_id, p_drop_point_id, 'manual_adjust', p_delta, p_notes, auth.uid());
END;
$$;
