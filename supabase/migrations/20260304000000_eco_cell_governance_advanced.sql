-- Migration: A29 — Governança Avançada por Célula
-- Fortalece a descentralização com papéis rotativos, mandatos, assembleias e votações.

-- A) eco_cell_charters (Carta da Célula)
CREATE TABLE IF NOT EXISTS public.eco_cell_charters (
    cell_id uuid PRIMARY KEY REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    version text NOT NULL,
    principles_md text,
    decision_process_md text,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_cell_charters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for charters" ON public.eco_cell_charters
    FOR SELECT USING (true);

CREATE POLICY "Operator/Moderator write for charters" ON public.eco_cell_charters
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- B) eco_cell_roles (Papéis da Célula)
CREATE TABLE IF NOT EXISTS public.eco_cell_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    role_key text NOT NULL,
    title text NOT NULL,
    description text,
    rotation_days int DEFAULT 30,
    max_holders int DEFAULT 2,
    active boolean DEFAULT true,
    UNIQUE(cell_id, role_key)
);

ALTER TABLE public.eco_cell_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for roles" ON public.eco_cell_roles
    FOR SELECT USING (true);

CREATE POLICY "Operator write for roles" ON public.eco_cell_roles
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- C) eco_cell_role_terms (Mandatos)
CREATE TABLE IF NOT EXISTS public.eco_cell_role_terms (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    role_key text NOT NULL,
    holder_user_id uuid REFERENCES auth.users(id),
    starts_at timestamptz DEFAULT now(),
    ends_at timestamptz,
    status text DEFAULT 'active' CHECK (status IN ('active', 'ended', 'revoked')),
    revoked_at timestamptz NULL,
    revoked_reason text NULL, -- Sanitized
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cell_role_terms_active ON public.eco_cell_role_terms(cell_id, role_key, status);

ALTER TABLE public.eco_cell_role_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operator/Moderator read/write for terms" ON public.eco_cell_role_terms
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

CREATE POLICY "User can read own terms" ON public.eco_cell_role_terms
    FOR SELECT TO authenticated
    USING (holder_user_id = auth.uid());

-- D) eco_cell_assemblies (Assembleias)
CREATE TABLE IF NOT EXISTS public.eco_cell_assemblies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    kind text CHECK (kind IN ('weekly', 'monthly', 'extra')),
    scheduled_for timestamptz NOT NULL,
    status text DEFAULT 'planned' CHECK (status IN ('planned', 'open', 'closed')),
    agenda_md text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_cell_assemblies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cell members read assemblies" ON public.eco_cell_assemblies
    FOR SELECT TO authenticated
    USING (true); -- Membership check via app or stricter RLS if needed

CREATE POLICY "Operator write assemblies" ON public.eco_cell_assemblies
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- E) eco_cell_proposals (Propostas)
CREATE TABLE IF NOT EXISTS public.eco_cell_proposals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    assembly_id uuid REFERENCES public.eco_cell_assemblies(id) ON DELETE SET NULL,
    title text NOT NULL,
    body_md text,
    decision_type text CHECK (decision_type IN ('policy', 'operation', 'spending', 'partnership', 'launch_control', 'other')),
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'voting', 'approved', 'rejected', 'archived')),
    voting_opens_at timestamptz,
    voting_closes_at timestamptz,
    quorum_min int DEFAULT 3,
    approval_threshold_pct numeric(5,2) DEFAULT 60.00,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_cell_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cell members read proposals" ON public.eco_cell_proposals
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Operator write proposals" ON public.eco_cell_proposals
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- F) eco_cell_votes (Votos)
CREATE TABLE IF NOT EXISTS public.eco_cell_votes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id uuid REFERENCES public.eco_cell_proposals(id) ON DELETE CASCADE,
    voter_user_id uuid REFERENCES auth.users(id),
    vote text NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(proposal_id, voter_user_id)
);

ALTER TABLE public.eco_cell_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can cast and read own vote" ON public.eco_cell_votes
    FOR ALL TO authenticated
    USING (voter_user_id = auth.uid());

-- G) eco_cell_decision_receipts (Recibos de Decisão)
CREATE TABLE IF NOT EXISTS public.eco_cell_decision_receipts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    proposal_id uuid UNIQUE REFERENCES public.eco_cell_proposals(id) ON DELETE SET NULL,
    cycle_id uuid REFERENCES public.eco_improvement_cycles(id) ON DELETE SET NULL,
    title text NOT NULL,
    summary_md text,
    outcome jsonb DEFAULT '{}'::jsonb,
    is_public boolean DEFAULT false,
    published_at timestamptz,
    published_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.eco_cell_decision_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for public receipts" ON public.eco_cell_decision_receipts
    FOR SELECT USING (is_public = true);

CREATE POLICY "Operator/Moderator full access to receipts" ON public.eco_cell_decision_receipts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('operator', 'moderator')));

-- H) Helper Functions & RPCs

-- 1. Get cell IDs for a user based on neighborhood associations
CREATE OR REPLACE FUNCTION public.fn_user_cell_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT DISTINCT cell_id 
    FROM public.eco_cell_neighborhoods 
    WHERE neighborhood_id IN (
        -- Assuming profiles might have a neighborhood_id or similar, 
        -- but if not, we check their active requests or memberships
        SELECT neighborhood_id FROM public.eco_access_grants WHERE user_id = p_user_id AND active = true
    );
$$;

-- 2. Open Assembly
CREATE OR REPLACE FUNCTION public.rpc_open_assembly(
    p_cell_id uuid,
    p_kind text,
    p_scheduled_for timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.eco_cell_assemblies (cell_id, kind, scheduled_for, status, created_by)
    VALUES (p_cell_id, p_kind, p_scheduled_for, 'open', auth.uid())
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- 3. Create Proposal
CREATE OR REPLACE FUNCTION public.rpc_create_proposal(
    p_cell_id uuid,
    p_title text,
    p_body_md text,
    p_decision_type text,
    p_assembly_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.eco_cell_proposals (cell_id, assembly_id, title, body_md, decision_type, created_by)
    VALUES (p_cell_id, p_assembly_id, p_title, p_body_md, p_decision_type, auth.uid())
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- 4. Open Voting
CREATE OR REPLACE FUNCTION public.rpc_open_voting(
    p_proposal_id uuid,
    p_closes_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.eco_cell_proposals
    SET status = 'voting', voting_opens_at = now(), voting_closes_at = p_closes_at, updated_at = now()
    WHERE id = p_proposal_id;
    
    RETURN found;
END;
$$;

-- 5. Close Voting & Generate Receipt
CREATE OR REPLACE FUNCTION public.rpc_close_voting(
    p_proposal_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_proposal record;
    v_votes record;
    v_outcome jsonb;
    v_status text;
BEGIN
    SELECT * INTO v_proposal FROM public.eco_cell_proposals WHERE id = p_proposal_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Aggregate Votes
    SELECT 
        count(*) as total,
        count(*) filter (where vote = 'yes') as yes,
        count(*) filter (where vote = 'no') as no,
        count(*) filter (where vote = 'abstain') as abstain
    INTO v_votes
    FROM public.eco_cell_votes WHERE proposal_id = p_proposal_id;

    v_outcome := jsonb_build_object(
        'total', v_votes.total,
        'yes', v_votes.yes,
        'no', v_votes.no,
        'abstain', v_votes.abstain,
        'quorum_met', v_votes.total >= v_proposal.quorum_min,
        'threshold_met', (CASE WHEN v_votes.total > 0 THEN (v_votes.yes::numeric / v_votes.total::numeric) * 100 >= v_proposal.approval_threshold_pct ELSE false END)
    );

    IF (v_outcome->>'quorum_met')::boolean AND (v_outcome->>'threshold_met')::boolean THEN
        v_status := 'approved';
    ELSE
        v_status := 'rejected';
    END IF;

    -- Update Proposal
    UPDATE public.eco_cell_proposals 
    SET status = v_status, updated_at = now() 
    WHERE id = p_proposal_id;

    -- Create Receipt
    INSERT INTO public.eco_cell_decision_receipts (cell_id, proposal_id, title, summary_md, outcome)
    VALUES (v_proposal.cell_id, p_proposal_id, v_proposal.title, LEFT(v_proposal.body_md, 200), v_outcome)
    ON CONFLICT (proposal_id) DO UPDATE SET outcome = EXCLUDED.outcome;

    -- Audit
    INSERT INTO public.admin_audit_log (operator_id, action, target_type, target_id, details)
    VALUES (auth.uid(), 'close_proposal_voting', 'eco_cell_proposal', p_proposal_id, v_outcome);

    RETURN v_outcome;
END;
$$;

-- 6. Role Assign/Revoke
CREATE OR REPLACE FUNCTION public.rpc_assign_role_term(
    p_cell_id uuid,
    p_role_key text,
    p_holder_id uuid,
    p_days int
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id uuid;
BEGIN
    -- End other active terms for this role/cell if needed, or check max_holders
    -- Simplification: manual rotation
    INSERT INTO public.eco_cell_role_terms (cell_id, role_key, holder_user_id, ends_at, created_by)
    VALUES (p_cell_id, p_role_key, p_holder_id, now() + (p_days || ' days')::interval, auth.uid())
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_revoke_role_term(
    p_term_id uuid,
    p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.eco_cell_role_terms
    SET status = 'revoked', revoked_at = now(), revoked_reason = p_reason
    WHERE id = p_term_id;
    
    RETURN found;
END;
$$;
