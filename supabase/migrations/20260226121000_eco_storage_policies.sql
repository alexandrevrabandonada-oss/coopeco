-- A5: Private storage bucket and strict policies for proof media.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'eco-media',
  'eco-media',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Access receipts media" ON storage.objects;
DROP POLICY IF EXISTS "Access posts media" ON storage.objects;
DROP POLICY IF EXISTS "Allow owners or operators to delete" ON storage.objects;
DROP POLICY IF EXISTS "eco_media_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "eco_media_update_owner_or_operator" ON storage.objects;
DROP POLICY IF EXISTS "eco_media_delete_owner_or_operator" ON storage.objects;
DROP POLICY IF EXISTS "eco_media_no_direct_select" ON storage.objects;

-- Upload allowed only for authenticated users, in scoped folders.
CREATE POLICY "eco_media_insert_authenticated"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'eco-media'
  AND owner = auth.uid()
  AND (
    (storage.foldername(name))[1] = 'receipts'
    OR
    (storage.foldername(name))[1] = 'posts'
  )
);

-- No SELECT policy is created on purpose:
-- direct download/list is denied for anon/authenticated.
-- files must be accessed through short-lived signed URLs generated server-side.

CREATE POLICY "eco_media_update_owner_or_operator"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'eco-media'
  AND (
    owner = auth.uid()
    OR public.has_role(ARRAY['operator'::public.app_role])
  )
)
WITH CHECK (
  bucket_id = 'eco-media'
  AND (
    owner = auth.uid()
    OR public.has_role(ARRAY['operator'::public.app_role])
  )
);

CREATE POLICY "eco_media_delete_owner_or_operator"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'eco-media'
  AND (
    owner = auth.uid()
    OR public.has_role(ARRAY['operator'::public.app_role])
  )
);

NOTIFY pgrst, 'reload schema';
