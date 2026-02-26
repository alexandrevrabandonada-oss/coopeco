-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('resident', 'cooperado', 'operator', 'moderator');
CREATE TYPE public.request_status AS ENUM ('open', 'accepted', 'en_route', 'collected', 'cancelled');
CREATE TYPE public.material_kind AS ENUM ('paper', 'plastic', 'metal', 'glass', 'oil', 'ewaste', 'reject');
CREATE TYPE public.unit_kind AS ENUM ('bag_p', 'bag_m', 'bag_g', 'box_p', 'box_m', 'box_g', 'oil_liters', 'ewaste_units');
CREATE TYPE public.post_kind AS ENUM ('registro', 'recibo', 'mutirao', 'chamado', 'ponto_critico', 'transparencia');
CREATE TYPE public.action_kind AS ENUM ('confirmar', 'apoiar', 'replicar', 'chamado', 'gratidao');
CREATE TYPE public.moderation_status AS ENUM ('open', 'resolved', 'rejected');

-- 2. TABLES
-- Neighborhoods
CREATE TABLE public.neighborhoods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role DEFAULT 'resident' NOT NULL,
    display_name TEXT,
    neighborhood_id UUID REFERENCES public.neighborhoods(id),
    is_public BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pickup Requests
CREATE TABLE public.pickup_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(user_id) NOT NULL,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) NOT NULL,
    status public.request_status DEFAULT 'open' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pickup Request Items
CREATE TABLE public.pickup_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.pickup_requests(id) ON DELETE CASCADE NOT NULL,
    material public.material_kind NOT NULL,
    unit public.unit_kind NOT NULL,
    qty INT NOT NULL CHECK (qty > 0 AND qty < 1000),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pickup Request Private (Sensitive Data)
CREATE TABLE public.pickup_request_private (
    request_id UUID PRIMARY KEY REFERENCES public.pickup_requests(id) ON DELETE CASCADE,
    address_full TEXT NOT NULL,
    contact_phone TEXT,
    geo_lat NUMERIC,
    geo_lng NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pickup Assignments
CREATE TABLE public.pickup_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID UNIQUE REFERENCES public.pickup_requests(id) ON DELETE CASCADE NOT NULL,
    cooperado_id UUID REFERENCES public.profiles(user_id) NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Receipts
CREATE TABLE public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID UNIQUE REFERENCES public.pickup_requests(id) NOT NULL,
    cooperado_id UUID REFERENCES public.profiles(user_id) NOT NULL,
    receipt_code TEXT UNIQUE NOT NULL,
    proof_photo_path TEXT,
    final_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Posts
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(user_id) NOT NULL,
    neighborhood_id UUID REFERENCES public.neighborhoods(id) NOT NULL,
    kind public.post_kind NOT NULL,
    title TEXT,
    body TEXT,
    receipt_id UUID REFERENCES public.receipts(id),
    is_pinned BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reactions/Actions
CREATE TABLE public.reactions_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(user_id) NOT NULL,
    kind public.action_kind NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id, kind)
);

-- Partners
CREATE TABLE public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL, -- collector, recycler, sponsor
    description TEXT,
    type TEXT, -- empresa, condominio, ecoponto
    neighborhood_id UUID REFERENCES public.neighborhoods(id),
    seal_active BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Partner Receipts
CREATE TABLE public.partner_receipts (
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
    PRIMARY KEY (partner_id, receipt_id)
);

-- Moderation Queue
CREATE TABLE public.moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'post', 'request', 'profile'
    entity_id UUID NOT NULL,
    reason TEXT,
    status public.moderation_status DEFAULT 'open' NOT NULL,
    created_by UUID REFERENCES public.profiles(user_id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. FUNCTIONS & TRIGGERS

-- Generate unique receipt code
CREATE OR REPLACE FUNCTION public.generate_receipt_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    done BOOLEAN := FALSE;
BEGIN
    WHILE NOT done LOOP
        new_code := upper(substring(md5(random()::text) from 1 for 8));
        DONE := NOT EXISTS (SELECT 1 FROM public.receipts WHERE receipt_code = new_code);
    END LOOP;
    RETURN new_code;
END;
        RAISE EXCEPTION 'Receipt can only be created by the assigned cooperado';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_receipt ON public.receipts;

-- 4. RLS POLICIES

ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_request_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

-- Helper: evaluate caller role without recursive policy checks
CREATE OR REPLACE FUNCTION public.has_role(roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = ANY(roles)
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(public.app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_assigned_cooperado(target_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pickup_assignments pa
    WHERE pa.request_id = target_request_id
      AND pa.cooperado_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_assigned_cooperado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_assigned_cooperado(uuid) TO authenticated;

-- Neighborhoods: Viewable by anyone
CREATE POLICY "Neighborhoods are public" ON public.neighborhoods FOR SELECT USING (true);

-- Profiles
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public profiles are public" ON public.profiles FOR SELECT USING (is_public = true);
CREATE POLICY "Operators/Moderators see all profiles" ON public.profiles FOR SELECT USING (
    public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role])
);

-- Pickup Requests
CREATE POLICY "Creators see their own requests" ON public.pickup_requests FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Residents see open requests in their neighborhood" ON public.pickup_requests FOR SELECT USING (
    status = 'open' AND neighborhood_id = (SELECT neighborhood_id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Operators see all requests" ON public.pickup_requests FOR SELECT USING (
    public.has_role(ARRAY['operator'::public.app_role])
);

-- Pickup Request Private
CREATE POLICY "Operators see all private data" ON public.pickup_request_private FOR SELECT USING (
    public.has_role(ARRAY['operator'::public.app_role])
);
CREATE POLICY "Assigned cooperado sees private data" ON public.pickup_request_private FOR SELECT USING (
    public.is_assigned_cooperado(public.pickup_request_private.request_id)
);

-- Receipts
CREATE POLICY "Assigned cooperado can insert receipts" ON public.receipts FOR INSERT WITH CHECK (
    public.is_assigned_cooperado(request_id)
);

CREATE POLICY "Users and Operators see receipts" ON public.receipts FOR SELECT USING (
    public.has_role(ARRAY['operator'::public.app_role]) OR
    EXISTS (SELECT 1 FROM public.pickup_requests WHERE id = request_id AND created_by = auth.uid()) OR
    cooperado_id = auth.uid()
);

-- Posts
CREATE POLICY "Posts are public" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Only operators can pin" ON public.posts FOR UPDATE USING (
    public.has_role(ARRAY['operator'::public.app_role])
);

-- 5. INDICES
CREATE INDEX idx_requests_status_neighborhood ON public.pickup_requests (status, neighborhood_id, created_at);
CREATE INDEX idx_assignments_cooperado ON public.pickup_assignments (cooperado_id, accepted_at);
CREATE INDEX idx_receipts_created ON public.receipts (created_at);
CREATE INDEX idx_posts_neighborhood_kind ON public.posts (neighborhood_id, created_at, kind);
CREATE INDEX idx_reactions_post ON public.reactions_actions (post_id);
