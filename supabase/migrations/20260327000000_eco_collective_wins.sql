-- Migration: A53 - Vitórias do Comum (Reconhecimento Coletivo)
-- Description: Criação da tabela de vitórias coletivas semanais, RPC de geração e view pública.

-- 1. Tabela de Vitórias Coletivas Semanais
CREATE TABLE IF NOT EXISTS public.eco_collective_wins_weekly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cell_id UUID NOT NULL REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    title TEXT NOT NULL CHECK (char_length(title) <= 120),
    body_md TEXT NOT NULL CHECK (char_length(body_md) <= 1200),
    highlights JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(cell_id, neighborhood_id, week_start)
);

-- Trigger to update 'updated_at'
CREATE OR REPLACE FUNCTION update_collective_wins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = TIMEZONE('utc'::text, NOW());
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_eco_collective_wins_weekly_updated_at
BEFORE UPDATE ON public.eco_collective_wins_weekly
FOR EACH ROW EXECUTE FUNCTION update_collective_wins_updated_at();

-- RLS
ALTER TABLE public.eco_collective_wins_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública apenas de publicadas"
    ON public.eco_collective_wins_weekly FOR SELECT
    USING (status = 'published');

CREATE POLICY "Operadores podem ver e editar (draft e published) de suas células"
    ON public.eco_collective_wins_weekly FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m
            WHERE m.user_id = auth.uid()
            AND m.cell_id = eco_collective_wins_weekly.cell_id
            AND m.status = 'active'
        )
    );
    
CREATE POLICY "Admins têm acesso total"
    ON public.eco_collective_wins_weekly FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );

-- 2. View Pública Sanitizada
CREATE OR REPLACE VIEW public.v_collective_wins_public AS
SELECT 
    id,
    cell_id,
    neighborhood_id,
    week_start,
    title,
    body_md,
    highlights,
    created_at
FROM public.eco_collective_wins_weekly
WHERE status = 'published';

-- 3. RPC de Geração Automática (Rascunho)
CREATE OR REPLACE FUNCTION public.rpc_generate_collective_wins(
    p_cell_id UUID,
    p_week_start DATE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_impact JSONB;
    v_wins_id UUID;
    v_title TEXT;
    v_body TEXT := '';
    v_neighborhood_id UUID := NULL; -- Por enquanto simplificando para Célula como um todo no gerador (ou pode iterar, aqui fixo null para rollup da célula)
    v_receipts_count INT := 0;
    v_ok_rate NUMERIC := 0;
    v_tasks_count INT := 0;
    v_evidence_count INT := 0;
BEGIN
    -- Validação básica de acesso (apenas operadores da célula ou admins)
    IF NOT EXISTS (
        SELECT 1 FROM public.eco_mandates 
        WHERE user_id = auth.uid() AND cell_id = p_cell_id AND status = 'active'
    ) AND NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true'
    ) THEN
        RAISE EXCEPTION 'Acesso negado: Apenas operadores da célula podem gerar Vitórias do Comum.';
    END IF;

    -- Tentar encontrar o rollup da mesma semana do A51
    SELECT metrics INTO v_impact 
    FROM public.eco_impact_rollups_weekly 
    WHERE cell_id = p_cell_id AND neighborhood_id IS NULL AND week_start = p_week_start;

    -- Se não existir, a gente processa na mosca primeiro
    IF v_impact IS NULL THEN
        v_impact := public.rpc_compute_impact_rollup(p_cell_id, p_week_start, NULL);
    END IF;

    -- Extrair métricas seguras do rollup
    v_receipts_count := COALESCE((v_impact->>'receipts_count')::int, 0);
    v_ok_rate := COALESCE((v_impact->>'ok_rate')::numeric, 0);
    v_tasks_count := COALESCE((v_impact->>'tasks_done_count')::int, 0);
    v_evidence_count := COALESCE((v_impact->>'evidence_approved_count')::int, 0);

    -- Determinar Título e Narrativa Baseada em Heurísticas Anti-Culpa (A53 Principles)
    v_title := 'Semana de Colheita e Aprendizado';
    
    IF v_ok_rate >= 80 AND v_receipts_count > 10 THEN
        v_title := 'Excelência Coletiva: O Comum Brilha na Triagem';
        v_body := v_body || 'Nossa dedicação coletiva resultou numa taxa admirável de materiais perfeitamente destinados. Cada pequena ação nas casas reflete um grande cuidado com o bairro.' || E'\n\n';
    ELSIF v_tasks_count > 5 THEN
        v_title := 'Mãos à Obra: O Cuidado do Comum em Ação';
        v_body := v_body || 'Esta semana, o que mais fez a diferença foi o trabalho voluntário nas Tarefas do Comum. Organização e solidariedade mantêm a nossa célula forte.' || E'\n\n';
    ELSE
        v_body := v_body || 'Semana dedicada à observação e ao suporte mútuo. Seguimos ajustando os laços para que nossas coletas ganhem força.' || E'\n\n';
    END IF;

    IF v_evidence_count > 0 THEN
        v_body := v_body || 'Além disso, somamos ' || v_evidence_count || ' registros transparentes das nossas ações em campo.' || E'\n';
    END IF;

    -- Inserir ou atualizar na eco_collective_wins_weekly (sempre como 'draft' para revisão local antes de publicar)
    INSERT INTO public.eco_collective_wins_weekly (
        cell_id, 
        neighborhood_id, 
        week_start, 
        title, 
        body_md, 
        highlights, 
        status
    ) VALUES (
        p_cell_id, 
        v_neighborhood_id, 
        p_week_start, 
        v_title, 
        v_body, 
        v_impact, 
        'draft'
    )
    ON CONFLICT (cell_id, neighborhood_id, week_start)
    DO UPDATE SET 
        title = EXCLUDED.title,
        body_md = EXCLUDED.body_md,
        highlights = EXCLUDED.highlights,
        status = 'draft' -- Força voltar a draft no re-gerar
    RETURNING id INTO v_wins_id;

    RETURN v_wins_id;
END;
$$;
