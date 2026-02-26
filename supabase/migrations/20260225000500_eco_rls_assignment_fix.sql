-- Ensure assigned cooperado can access private request data without RLS recursion/denial.

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

DROP POLICY IF EXISTS "Assigned cooperado sees private data" ON public.pickup_request_private;
CREATE POLICY "Assigned cooperado sees private data"
ON public.pickup_request_private
FOR SELECT
USING (public.is_assigned_cooperado(public.pickup_request_private.request_id));
