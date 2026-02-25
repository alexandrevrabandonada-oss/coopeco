-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('eco-media', 'eco-media', false);

-- 2. RLS Policies for eco-media bucket

-- UPLOAD: Only authenticated users can upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'eco-media');

-- SELECT: Granular access based on path patterns
-- Pattern: receipts/{receipt_id}/{filename}
CREATE POLICY "Access receipts media"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'eco-media' 
    AND (storage.foldername(name))[1] = 'receipts'
    AND (
        -- Is the creator of the request linked to the receipt
        EXISTS (
            SELECT 1 FROM public.receipts r
            JOIN public.pickup_requests pr ON r.request_id = pr.id
            WHERE r.id::text = (storage.foldername(name))[2]
            AND pr.created_by = auth.uid()
        )
        -- OR is the assigned cooperado
        OR EXISTS (
            SELECT 1 FROM public.receipts r
            WHERE r.id::text = (storage.foldername(name))[2]
            AND r.cooperado_id = auth.uid()
        )
        -- OR is an operator
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() AND role = 'operator'
        )
    )
);

-- SELECT: Posts media
-- Pattern: posts/{post_id}/{filename}
CREATE POLICY "Access posts media"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'eco-media' 
    AND (storage.foldername(name))[1] = 'posts'
    -- Note: For simplicity in MVP, we check if the post is associated. 
    -- More complex logic (is_public) can be added or handled via signed URLs.
    AND EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id::text = (storage.foldername(name))[2]
    )
);

-- DELETE: Only owners or operators
CREATE POLICY "Allow owners or operators to delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'eco-media'
    AND (
        owner = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE user_id = auth.uid() AND role = 'operator'
        )
    )
);
