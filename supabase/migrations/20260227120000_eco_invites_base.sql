-- Migration: A17 — Convites de Base & Missões do Comum
-- Tabelas para crescimento orgânico e missões coletivas.

-- A) invite_codes
CREATE TABLE IF NOT EXISTS public.invite_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('neighborhood', 'drop_point', 'partner')),
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    drop_point_id UUID REFERENCES public.eco_drop_points(id) ON DELETE CASCADE,
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK (
        (scope = 'neighborhood' AND neighborhood_id IS NOT NULL) OR
        (scope = 'drop_point' AND drop_point_id IS NOT NULL) OR
        (scope = 'partner' AND partner_id IS NOT NULL)
    )
);

-- RLS: invite_codes
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invite codes are viewable by anyone if active" 
ON public.invite_codes FOR SELECT 
USING (active = true);

CREATE POLICY "Operators and moderators can manage invite codes" 
ON public.invite_codes FOR ALL 
TO authenticated 
USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

-- B) invite_events
CREATE TABLE IF NOT EXISTS public.invite_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_id UUID NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
    event_kind TEXT NOT NULL CHECK (event_kind IN ('opened', 'signup_completed', 'first_action_done')),
    anon_fingerprint_hash TEXT, -- Opcional, sem PII
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: invite_events
ALTER TABLE public.invite_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert invite events" 
ON public.invite_events FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Operators can read invite events" 
ON public.invite_events FOR SELECT 
TO authenticated 
USING (public.has_role(ARRAY['operator'::public.app_role]));

-- C) community_missions
CREATE TABLE IF NOT EXISTS public.community_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL CHECK (scope IN ('neighborhood', 'drop_point')),
    neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    drop_point_id UUID REFERENCES public.eco_drop_points(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('bring_neighbor', 'become_anchor', 'start_recurring', 'reactivate_point')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: community_missions
ALTER TABLE public.community_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Missions are viewable by public" 
ON public.community_missions FOR SELECT 
USING (true);

CREATE POLICY "Operators manage missions" 
ON public.community_missions FOR ALL 
TO authenticated 
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- D) mission_progress
CREATE TABLE IF NOT EXISTS public.mission_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID UNIQUE NOT NULL REFERENCES public.community_missions(id) ON DELETE CASCADE,
    progress_count INT DEFAULT 0 NOT NULL,
    goal_count INT DEFAULT 10 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: mission_progress
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Progress is viewable by public" 
ON public.mission_progress FOR SELECT 
USING (true);

CREATE POLICY "Operators update progress" 
ON public.mission_progress FOR ALL 
TO authenticated 
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

-- E) Seed initial missions and codes (opcional para teste)
-- In real scenario, operator does this via UI.

NOTIFY pgrst, 'reload schema';
