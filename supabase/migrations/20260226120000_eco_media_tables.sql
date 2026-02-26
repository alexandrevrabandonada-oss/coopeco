-- A5: Media metadata table + RLS for secure proof media.

CREATE TABLE IF NOT EXISTS public.media_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL DEFAULT 'eco-media',
  path TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('receipt', 'post')),
  entity_id UUID NOT NULL,
  mime TEXT NOT NULL,
  bytes INT NOT NULL CHECK (bytes >= 0),
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (entity_type = 'receipt' AND path LIKE 'receipts/%')
    OR
    (entity_type = 'post' AND path LIKE 'posts/%')
  )
);

CREATE INDEX IF NOT EXISTS idx_media_objects_entity
  ON public.media_objects(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_media_objects_owner_created
  ON public.media_objects(owner_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.can_view_receipt_media(target_receipt_id UUID, actor_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.receipts r
    JOIN public.pickup_requests pr ON pr.id = r.request_id
    WHERE r.id = target_receipt_id
      AND (
        actor_id = r.cooperado_id
        OR actor_id = pr.created_by
        OR EXISTS (
          SELECT 1
          FROM public.pickup_assignments pa
          WHERE pa.request_id = r.request_id
            AND pa.cooperado_id = actor_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles op
          WHERE op.user_id = actor_id
            AND op.role = 'operator'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_receipt_media(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_receipt_media(UUID, UUID) TO authenticated;

ALTER TABLE public.media_objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Media insert own rows" ON public.media_objects;
CREATE POLICY "Media insert own rows"
ON public.media_objects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Media select secure" ON public.media_objects;
CREATE POLICY "Media select secure"
ON public.media_objects
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR public.has_role(ARRAY['operator'::public.app_role])
  OR (
    entity_type = 'receipt'
    AND public.can_view_receipt_media(entity_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Media update owner_or_operator_if_not_frozen" ON public.media_objects;
CREATE POLICY "Media update owner_or_operator_if_not_frozen"
ON public.media_objects
FOR UPDATE
TO authenticated
USING (
  public.has_role(ARRAY['operator'::public.app_role])
  OR (auth.uid() = owner_id AND is_frozen = false)
)
WITH CHECK (
  public.has_role(ARRAY['operator'::public.app_role])
  OR (auth.uid() = owner_id AND is_frozen = false)
);

DROP POLICY IF EXISTS "Media delete owner_or_operator_if_not_frozen" ON public.media_objects;
CREATE POLICY "Media delete owner_or_operator_if_not_frozen"
ON public.media_objects
FOR DELETE
TO authenticated
USING (
  public.has_role(ARRAY['operator'::public.app_role])
  OR (auth.uid() = owner_id AND is_frozen = false)
);

NOTIFY pgrst, 'reload schema';
