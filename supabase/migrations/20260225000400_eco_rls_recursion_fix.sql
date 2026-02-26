-- Fix recursive RLS checks caused by policies reading profiles inside profiles policy.
-- This migration is safe to run once and aligns the policy model to a helper function.

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

DROP POLICY IF EXISTS "Operators/Moderators see all profiles" ON public.profiles;
CREATE POLICY "Operators/Moderators see all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(ARRAY['operator'::public.app_role, 'moderator'::public.app_role]));

DROP POLICY IF EXISTS "Operators see all requests" ON public.pickup_requests;
CREATE POLICY "Operators see all requests"
ON public.pickup_requests
FOR SELECT
USING (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators see all private data" ON public.pickup_request_private;
CREATE POLICY "Operators see all private data"
ON public.pickup_request_private
FOR SELECT
USING (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Only operators can pin" ON public.posts;
CREATE POLICY "Only operators can pin"
ON public.posts
FOR UPDATE
USING (public.has_role(ARRAY['operator'::public.app_role]));
