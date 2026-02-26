-- Allow authenticated users to create posts in their own neighborhood
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Posts are public" ON public.posts;
CREATE POLICY "Posts are public" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create posts in their neighborhood" ON public.posts;
CREATE POLICY "Users can create posts in their neighborhood" ON public.posts 
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts 
FOR UPDATE USING (
    auth.uid() = created_by
);

DROP POLICY IF EXISTS "Only operators can pin" ON public.posts;
CREATE POLICY "Only operators can pin" ON public.posts 
FOR UPDATE USING (
    public.has_role(ARRAY['operator'::public.app_role])
);
