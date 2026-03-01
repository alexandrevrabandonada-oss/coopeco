-- Migration: A52 - Evidência Opcional Segura (Tarefas do Comum)
-- Description: Criação das tabelas de evidência de tarefas, políticas globais de upload e setup de storage privado.

-- 1. Políticas Globais de Evidência (Limites)
CREATE TABLE IF NOT EXISTS public.eco_task_evidence_policy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT UNIQUE NOT NULL,
    rules_md TEXT NOT NULL,
    max_files INT DEFAULT 3,
    max_bytes INT DEFAULT 2000000, -- 2MB
    allowed_mime TEXT[] DEFAULT '{image/jpeg,image/png,application/pdf}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insert policy default v1.0
INSERT INTO public.eco_task_evidence_policy (version, rules_md)
VALUES (
    'v1.0', 
    'Zero PII: Sem rostos visíveis, sem placas de carro, sem endereços residenciais exatos. A evidência é para o comum, não para vigilância individual.'
) ON CONFLICT (version) DO NOTHING;

-- RLS: Policy (Leitura pública para validação UI, Escrita apenas para Admin)
ALTER TABLE public.eco_task_evidence_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ler a política de evidência"
    ON public.eco_task_evidence_policy FOR SELECT USING (true);

CREATE POLICY "Apenas admins alteram políticas"
    ON public.eco_task_evidence_policy FOR ALL USING (
        EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'is_admin' = 'true')
    );

-- 2. Tabela de Anexos/Evidências
CREATE TABLE IF NOT EXISTS public.eco_task_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.eco_common_tasks(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'pdf', 'link')),
    title TEXT,
    storage_path TEXT, -- Null if link
    external_url TEXT, -- Null if storage
    mime_type TEXT,
    size_bytes BIGINT,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'needs_review', 'rejected', 'approved')),
    review_notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.eco_task_evidence ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver, inserir e editar suas próprias evidências
CREATE POLICY "Assignees controlam suas evidências"
    ON public.eco_task_evidence
    FOR ALL
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Operadores da célula também podem ver e editar (para revisão local)
CREATE POLICY "Operadores podem gerenciar evidências da célula"
    ON public.eco_task_evidence
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m
            JOIN public.eco_common_tasks t ON t.cell_id = m.cell_id
            WHERE m.user_id = auth.uid()
            AND m.status = 'active'
            AND t.id = eco_task_evidence.task_id
        )
    );

-- 3. Storage Bucket: eco-evidence (Privado)
-- Criando o bucket caso não exista e inserindo diretrizes de RLS do Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('eco-evidence', 'eco-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- RLS do Storage:
-- Ninguém acessa livremente (public=false). O app vai gerar Signed URLs via backend (usando Service Role).
-- Opcionalmente, podemos permitir que os próprios usuários subam pro bucket via RLS, mas faremos via Service Role e Signed Upload URLs por segurança extrema contra PII e validação prévia.
