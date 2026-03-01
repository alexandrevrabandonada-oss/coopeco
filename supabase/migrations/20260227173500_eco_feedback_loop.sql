-- Migration: A22-ECO — Feedback Loop (Rua -> Produto)
-- Created: 2026-02-27

-- 1. Feedback Items
CREATE TABLE IF NOT EXISTS public.eco_feedback_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id UUID REFERENCES public.eco_cells(id) ON DELETE SET NULL,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    role_at_time TEXT NOT NULL, -- resident, cooperado, operator, moderator
    category TEXT NOT NULL CHECK (category IN ('ops_route','ops_drop_point','quality','education','payments','ui_bug','onboarding','governance','other')),
    severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','blocker')),
    context_kind TEXT, -- window, drop_point, lot, payout, invite, mission, page
    context_id UUID,
    summary TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','planned','done','wontfix')),
    triage_notes TEXT,
    triaged_by UUID REFERENCES auth.users(id),
    next_prompt_hint TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Anti-PII Constraints
    CONSTRAINT feedback_summary_length CHECK (char_length(summary) <= 120),
    CONSTRAINT feedback_details_length CHECK (char_length(details) <= 500),
    CONSTRAINT feedback_triage_notes_length CHECK (char_length(triage_notes) <= 300),
    
    -- Simple Regex for PII (Email and Brazilian Phone patterns)
    CONSTRAINT no_email_in_details CHECK (details IS NULL OR details !~* '[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,4}'),
    CONSTRAINT no_phone_in_details CHECK (details IS NULL OR details !~* '(\d{2,3})? ?\d{4,5}-?\d{4}'),
    CONSTRAINT no_email_in_summary CHECK (summary !~* '[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,4}'),
    CONSTRAINT no_phone_in_summary CHECK (summary !~* '(\d{2,3})? ?\d{4,5}-?\d{4}')
);

-- 2. Feedback Tags
CREATE TABLE IF NOT EXISTS public.eco_feedback_tags (
    feedback_id UUID REFERENCES public.eco_feedback_items(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (feedback_id, tag)
);

-- 3. Feedback Rollups (Weekly)
CREATE TABLE IF NOT EXISTS public.eco_feedback_rollups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cell_id UUID REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    top_categories JSONB DEFAULT '[]'::jsonb,
    blockers_count INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cell_id, week_start)
);

-- 4. RLS Policies

ALTER TABLE public.eco_feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_feedback_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eco_feedback_rollups ENABLE ROW LEVEL SECURITY;

-- Submission: Any authenticated user
CREATE POLICY "Users can submit feedback" ON public.eco_feedback_items
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Selection: Operators/Moderators see all; authors see their own
CREATE POLICY "Operators see all feedback items" ON public.eco_feedback_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin', 'moderator'))
        OR auth.uid() = created_by
    );

-- Triage: Only Operators/Moderators/Admins
CREATE POLICY "Operators triage feedback items" ON public.eco_feedback_items
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin', 'moderator')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin', 'moderator')));

-- Rollups: Same as triage
CREATE POLICY "Operators manage rollups" ON public.eco_feedback_rollups
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin', 'moderator')));

-- Tags: Same as feedback
CREATE POLICY "Users manage feedback tags" ON public.eco_feedback_tags
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.eco_feedback_items WHERE id = feedback_id AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('operator', 'admin', 'moderator')))));

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_feedback_updated_at
    BEFORE UPDATE ON public.eco_feedback_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
