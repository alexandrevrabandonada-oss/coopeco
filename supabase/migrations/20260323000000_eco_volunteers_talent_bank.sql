-- Migration: A49 — Voluntários & Banco de Talentos
-- supabase/migrations/20260323000000_eco_volunteers_talent_bank.sql

-- 1. eco_skills_catalog
CREATE TABLE IF NOT EXISTS public.eco_skills_catalog (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    slug text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

-- 2. eco_volunteer_profiles
CREATE TABLE IF NOT EXISTS public.eco_volunteer_profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE SET NULL,
    is_opt_in boolean DEFAULT false,
    display_name text,
    availability text DEFAULT 'medium' CHECK (availability IN ('low', 'medium', 'high')),
    preferred_roles text[] DEFAULT '{}',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. eco_volunteer_skills
CREATE TABLE IF NOT EXISTS public.eco_volunteer_skills (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_id uuid REFERENCES public.eco_skills_catalog(id) ON DELETE CASCADE,
    level text DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    PRIMARY KEY (user_id, skill_id)
);

-- 4. eco_calls (Chamados do Comum)
CREATE TABLE IF NOT EXISTS public.eco_calls (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('volunteer', 'cooperado_extra', 'mutirao', 'comms', 'curation', 'logistics', 'dev')),
    title text NOT NULL,
    body_md text NOT NULL,
    skill_slugs text[] DEFAULT '{}',
    urgency text DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
    status text DEFAULT 'open' CHECK (status IN ('open', 'filled', 'closed')),
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. eco_call_interests
CREATE TABLE IF NOT EXISTS public.eco_call_interests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id uuid REFERENCES public.eco_calls(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    message text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(call_id, user_id)
);

-- RLS & Policies
ALTER TABLE public.eco_skills_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_volunteer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_volunteer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_call_interests ENABLE ROW LEVEL SECURITY;

-- Skills Catalog: Public read
CREATE POLICY "Public read skills" ON public.eco_skills_catalog FOR SELECT USING (true);

-- Volunteer Profiles: Own read/write; Operator read within cell
CREATE POLICY "Users manage own volunteer profile" ON public.eco_volunteer_profiles
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Operators read cell volunteer profiles" ON public.eco_volunteer_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m 
            WHERE m.user_id = auth.uid() AND m.cell_id = eco_volunteer_profiles.cell_id AND m.status = 'active'
        )
    );

-- Volunteer Skills: Same as profiles
CREATE POLICY "Users manage own volunteer skills" ON public.eco_volunteer_skills
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Operators read cell volunteer skills" ON public.eco_volunteer_skills
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.eco_volunteer_profiles p
            JOIN public.eco_mandates m ON m.cell_id = p.cell_id
            WHERE p.user_id = eco_volunteer_skills.user_id
            AND m.user_id = auth.uid() AND m.status = 'active'
        )
    );

-- Calls: Public read open; Operator write cell
CREATE POLICY "Anyone read open calls" ON public.eco_calls
    FOR SELECT USING (status = 'open');

CREATE POLICY "Operators manage cell calls" ON public.eco_calls
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.eco_mandates m 
            WHERE m.user_id = auth.uid() AND m.cell_id = eco_calls.cell_id AND m.status = 'active'
        )
    );

-- Interests: Own read/update; Operator read/update cell
CREATE POLICY "Users manage own interests" ON public.eco_call_interests
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Operators manage cell call interests" ON public.eco_call_interests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.eco_calls c
            JOIN public.eco_mandates m ON m.cell_id = c.cell_id
            WHERE c.id = eco_call_interests.call_id
            AND m.user_id = auth.uid() AND m.status = 'active'
        )
    );

-- Seed Initial Skills
INSERT INTO public.eco_skills_catalog (slug, name, description) VALUES
('design', 'Design & Sticker', 'Criação de artes, stickers e materiais visuais para a célula.'),
('video', 'Audiovisual', 'Edição de vídeos curtos, reels e cobertura de mutirões.'),
('copy', 'Redação e Copy', 'Escrita de boletins, avisos e campanhas anti-culpa.'),
('ops_route', 'Planejamento de Rota', 'Apoio na logística e otimização de janelas de coleta.'),
('logistics', 'Logística de Galpão', 'Apoio físico e organização na triagem e pesagem.'),
('education', 'Educação Ambiental', 'Facilitação de oficinas e dicas de separação para vizinhos.'),
('dev', 'Desenvolvimento / Tech', 'Apoio em automações, bots e melhorias no app COOP ECO.'),
('moderation', 'Mediação e Facilitador', 'Apoio em assembleias e rituais de governança da célula.'),
('events', 'Mutirões e Eventos', 'Organização de eventos presenciais e mutirões de limpeza.')
ON CONFLICT (slug) DO NOTHING;
