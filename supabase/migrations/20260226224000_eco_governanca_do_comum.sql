-- A11: Governanca do Comum (papeis rotativos + recibo de decisao)

CREATE TABLE IF NOT EXISTS public.governance_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('city', 'neighborhood')),
  neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL CHECK (role_name IN ('operator', 'moderator')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'city' AND neighborhood_id IS NULL)
    OR (scope = 'neighborhood' AND neighborhood_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_governance_role_city
  ON public.governance_roles (role_name)
  WHERE scope = 'city';

CREATE UNIQUE INDEX IF NOT EXISTS uq_governance_role_neighborhood
  ON public.governance_roles (neighborhood_id, role_name)
  WHERE scope = 'neighborhood';

CREATE TABLE IF NOT EXISTS public.governance_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  governance_role_id UUID NOT NULL REFERENCES public.governance_roles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  starts_at DATE NOT NULL,
  ends_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'completed')),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at >= starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_governance_term_active_per_role
  ON public.governance_terms (governance_role_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_governance_terms_user_dates
  ON public.governance_terms (user_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS public.decision_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  governance_term_id UUID REFERENCES public.governance_terms(id) ON DELETE SET NULL,
  decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  summary_public TEXT NOT NULL,
  rationale_public TEXT,
  implementation_public TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_receipts_neighborhood_date
  ON public.decision_receipts (neighborhood_id, decision_date DESC);

DROP TRIGGER IF EXISTS tr_governance_roles_updated_at ON public.governance_roles;
CREATE TRIGGER tr_governance_roles_updated_at
BEFORE UPDATE ON public.governance_roles
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

DROP TRIGGER IF EXISTS tr_governance_terms_updated_at ON public.governance_terms;
CREATE TRIGGER tr_governance_terms_updated_at
BEFORE UPDATE ON public.governance_terms
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

DROP TRIGGER IF EXISTS tr_decision_receipts_updated_at ON public.decision_receipts;
CREATE TRIGGER tr_decision_receipts_updated_at
BEFORE UPDATE ON public.decision_receipts
FOR EACH ROW
EXECUTE FUNCTION public.eco_set_updated_at();

ALTER TABLE public.governance_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators manage governance roles" ON public.governance_roles;
CREATE POLICY "Operators manage governance roles"
ON public.governance_roles
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators manage governance terms" ON public.governance_terms;
CREATE POLICY "Operators manage governance terms"
ON public.governance_terms
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators manage decision receipts" ON public.decision_receipts;
CREATE POLICY "Operators manage decision receipts"
ON public.decision_receipts
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Authenticated read published decision receipts" ON public.decision_receipts;
CREATE POLICY "Authenticated read published decision receipts"
ON public.decision_receipts
FOR SELECT
TO authenticated
USING (status = 'published' OR public.has_role(ARRAY['operator'::public.app_role]));

CREATE OR REPLACE VIEW public.v_decision_receipts_public AS
SELECT
  dr.id,
  dr.neighborhood_id,
  n.slug,
  n.name AS neighborhood_name,
  dr.decision_date,
  dr.title,
  dr.summary_public,
  dr.rationale_public,
  dr.implementation_public,
  dr.created_at
FROM public.decision_receipts dr
JOIN public.neighborhoods n ON n.id = dr.neighborhood_id
WHERE dr.status = 'published';

GRANT SELECT ON public.v_decision_receipts_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
