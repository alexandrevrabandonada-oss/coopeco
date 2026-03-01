-- Migration: A47 — Toolbox de Formação
-- supabase/migrations/20260321000000_eco_training_toolbox.sql

-- 1. eco_training_tracks: Core courses
CREATE TABLE IF NOT EXISTS public.eco_training_tracks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    scope text NOT NULL CHECK (scope IN ('global', 'cell')),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    slug text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    duration_minutes int DEFAULT 15,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(scope, cell_id, slug)
);

-- 2. eco_training_lessons: Individual steps
CREATE TABLE IF NOT EXISTS public.eco_training_lessons (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    track_id uuid REFERENCES public.eco_training_tracks(id) ON DELETE CASCADE,
    order_index int NOT NULL,
    title text NOT NULL,
    body_md text NOT NULL,
    link_url text, -- Internal or external relative path
    created_at timestamptz DEFAULT now()
);

-- 3. eco_training_progress: User tracking
CREATE TABLE IF NOT EXISTS public.eco_training_progress (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id uuid REFERENCES public.eco_training_tracks(id) ON DELETE CASCADE,
    status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at timestamptz,
    completed_at timestamptz,
    current_lesson_index int DEFAULT 0,
    UNIQUE(user_id, track_id)
);

-- 4. eco_training_certificates: Internal recognition
CREATE TABLE IF NOT EXISTS public.eco_training_certificates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id uuid REFERENCES public.eco_training_tracks(id) ON DELETE CASCADE,
    code text UNIQUE NOT NULL, -- Short unique code for verification
    issued_at timestamptz DEFAULT now(),
    is_public boolean DEFAULT false
);

-- RLS & Policies
ALTER TABLE public.eco_training_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_training_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_training_certificates ENABLE ROW LEVEL SECURITY;

-- Read tracks/lessons: Public
CREATE POLICY "Public read for tracks" ON public.eco_training_tracks FOR SELECT USING (true);
CREATE POLICY "Public read for lessons" ON public.eco_training_lessons FOR SELECT USING (true);

-- Progress: Own only
CREATE POLICY "Users read own progress" ON public.eco_training_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON public.eco_training_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users modify own progress" ON public.eco_training_progress FOR UPDATE USING (auth.uid() = user_id);

-- Certificates: Own OR Public
CREATE POLICY "Users read own certificates" ON public.eco_training_certificates FOR SELECT USING (auth.uid() = user_id OR is_public = true);

-- Seed Initial tracks
DO $$
DECLARE
    track_op_id uuid;
    track_qual_id uuid;
    track_comm_id uuid;
    track_cur_id uuid;
    track_gov_id uuid;
BEGIN
    -- 1. Operação
    INSERT INTO public.eco_training_tracks (scope, slug, title, description, duration_minutes)
    VALUES ('global', 'operacao-v1', 'Operação Territorial', 'Como gerenciar janelas, pontos de coleta e logística do galpão.', 20)
    RETURNING id INTO track_op_id;

    INSERT INTO public.eco_training_lessons (track_id, order_index, title, body_md, link_url) VALUES
    (track_op_id, 1, 'Visão Geral do Fluxo', 'O ECO funciona através de janelas de coleta recorrentes em pontos específicos.', '/admin/operacao'),
    (track_op_id, 2, 'Gerenciando Janelas', 'Aprenda a ativar e desativar janelas de acordo com a capacidade da célula.', '/admin/operacao'),
    (track_op_id, 3, 'O Galpão e a Triagem', 'Organização física e processamento de materiais.', '/admin/galpao');

    -- 2. Qualidade
    INSERT INTO public.eco_training_tracks (scope, slug, title, description, duration_minutes)
    VALUES ('global', 'qualidade-v1', 'Qualidade ECO', 'Nível de contaminação, triagem fina e o foco educativo da semana.', 15)
    RETURNING id INTO track_qual_id;

    INSERT INTO public.eco_training_lessons (track_id, order_index, title, body_md, link_url) VALUES
    (track_qual_id, 1, 'Padrão Seco e Separado', 'Por que a limpeza é o fator mais importante para o valor do material.', '/bairros/centro/semana'),
    (track_qual_id, 2, 'Identificando Contaminação', 'Como registrar infrações de qualidade sem culpar o cooperado.', '/admin/copy');

    -- 3. Comunicação
    INSERT INTO public.eco_training_tracks (scope, slug, title, description, duration_minutes)
    VALUES ('global', 'comunicacao-v1', 'Comunicação e Anti-Culpa', 'Uso do linter, templates por célula e campanhas de cultura.', 15)
    RETURNING id INTO track_comm_id;

    INSERT INTO public.eco_training_lessons (track_id, order_index, title, body_md, link_url) VALUES
    (track_comm_id, 1, 'Princípios Anti-Culpa', 'Educação como cuidado, responsabilidade coletiva > culpa individual.', '/admin/copy'),
    (track_comm_id, 2, 'Usando o Linter', 'Como garantir que nossos boletins respeitam a política de linguagem.', '/admin/copy'),
    (track_comm_id, 3, 'Lançando Campanhas', 'O Kit Digital de 7 dias para novos territórios.', '/admin/campanha');

    -- 4. Curadoria
    INSERT INTO public.eco_training_tracks (scope, slug, title, description, duration_minutes)
    VALUES ('global', 'curadoria-v1', 'Curadoria de Mídia', 'Produção de conteúdo local, transcrição e privacidade.', 20)
    RETURNING id INTO track_cur_id;

    INSERT INTO public.eco_training_lessons (track_id, order_index, title, body_md, link_url) VALUES
    (track_cur_id, 1, 'Privacidade na Prática', 'Remoção de PII e tratamento de metadados em fotos/vídeos.', '/admin/curadoria'),
    (track_cur_id, 2, 'Acessibilidade Multimídia', 'Usando transcrições para garantir que o conhecimento chegue a todos.', '/admin/curadoria');

    -- 5. Governança
    INSERT INTO public.eco_training_tracks (scope, slug, title, description, duration_minutes)
    VALUES ('global', 'governanca-v1', 'Governança e Transparência', 'Melhoria contínua (A28) e rituais da célula.', 10)
    RETURNING id INTO track_gov_id;

    INSERT INTO public.eco_training_lessons (track_id, order_index, title, body_md, link_url) VALUES
    (track_gov_id, 1, 'O Ciclo de Melhoria', 'Como transformar falhas operacionais em itens de backlog.', '/admin/melhorias'),
    (track_gov_id, 2, 'Transparência Agregada', 'O Recibo é Lei e o Score do Bairro como ferramentas políticas.', '/admin/governanca');
END $$;
