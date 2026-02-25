-- 1. CLEANUP (Careful!)
-- DELETE FROM public.pickup_requests;
-- DELETE FROM public.profiles;

-- 2. INSERT TEST DATA
-- Insert a neighborhood
INSERT INTO public.neighborhoods (slug, name) VALUES ('planalto', 'Planalto');

-- Insert profiles (simulate auth.users behavior)
-- Note: Replace UUIDs with real ones from your auth.users table if testing in dashboard
-- INSERT INTO public.profiles (user_id, role, display_name, neighborhood_id) 
-- VALUES ('<uuid>', 'resident', 'João ECO', (SELECT id FROM public.neighborhoods WHERE slug='planalto'));

-- 3. SANITY QUERIES
-- Check counts
SELECT 'neighborhoods' as tbl, count(*) FROM public.neighborhoods
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'pickup_requests', count(*) FROM public.pickup_requests;

-- Test RLS (Run as specific user role if possible in dashboard)
-- Should see only public profiles or own
-- SELECT * FROM public.profiles;

-- Check assignments for a specific cooperador
-- SELECT * FROM public.pickup_assignments WHERE cooperado_id = auth.uid();

-- 4. VERIFY PRIVACY
-- Residents should see count > 0 for requests but 0 for private data
-- SELECT count(*) FROM public.pickup_requests;
-- SELECT count(*) FROM public.pickup_request_private;
