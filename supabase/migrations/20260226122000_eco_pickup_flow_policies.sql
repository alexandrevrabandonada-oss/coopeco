-- A5 support: ensure assigned cooperado can run receipt flow end-to-end.

DROP POLICY IF EXISTS "Assigned cooperado sees assigned requests" ON public.pickup_requests;
CREATE POLICY "Assigned cooperado sees assigned requests"
ON public.pickup_requests
FOR SELECT
TO authenticated
USING (public.is_assigned_cooperado(id));

DROP POLICY IF EXISTS "Assigned cooperado updates assigned requests" ON public.pickup_requests;
CREATE POLICY "Assigned cooperado updates assigned requests"
ON public.pickup_requests
FOR UPDATE
TO authenticated
USING (public.is_assigned_cooperado(id))
WITH CHECK (public.is_assigned_cooperado(id));

DROP POLICY IF EXISTS "Assigned cooperado can insert receipts" ON public.receipts;
CREATE POLICY "Assigned cooperado can insert receipts"
ON public.receipts
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_assigned_cooperado(request_id)
  AND cooperado_id = auth.uid()
);

NOTIFY pgrst, 'reload schema';
