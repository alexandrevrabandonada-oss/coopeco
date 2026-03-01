-- Migration: A38 — Performance & Cache Pack
-- supabase/migrations/20260312000000_eco_perf_cache.sql

-- A) eco_agg_cache: Centralized cache for sanitized aggregates
CREATE TABLE IF NOT EXISTS public.eco_agg_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key text UNIQUE NOT NULL,
    scope text NOT NULL CHECK (scope IN ('global', 'cell', 'neighborhood')),
    cell_id uuid REFERENCES public.eco_cells(id) ON DELETE CASCADE,
    neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
    payload jsonb NOT NULL,
    ttl_seconds int DEFAULT 300,
    computed_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    CHECK (
        (scope = 'global') OR
        (scope = 'cell' AND cell_id IS NOT NULL) OR
        (scope = 'neighborhood' AND neighborhood_id IS NOT NULL)
    )
);

ALTER TABLE public.eco_agg_cache ENABLE ROW LEVEL SECURITY;

-- Read restricted to authenticated users (internal use)
CREATE POLICY "Allow read for authenticated" ON public.eco_agg_cache FOR SELECT TO authenticated USING (true);

-- Indexes for fast lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_eco_agg_cache_expires ON public.eco_agg_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_eco_agg_cache_key_scope ON public.eco_agg_cache (cache_key, scope);

-- B) rpc_get_agg_cache: Get or invalidate cache entry
CREATE OR REPLACE FUNCTION public.rpc_get_agg_cache(
    p_cache_key text,
    p_scope text,
    p_cell_id uuid DEFAULT NULL,
    p_neighborhood_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cached record;
BEGIN
    SELECT * INTO v_cached 
    FROM public.eco_agg_cache
    WHERE cache_key = p_cache_key 
      AND scope = p_scope 
      AND (cell_id = p_cell_id OR (p_cell_id IS NULL AND cell_id IS NULL))
      AND (neighborhood_id = p_neighborhood_id OR (p_neighborhood_id IS NULL AND neighborhood_id IS NULL))
      AND expires_at > now();

    IF FOUND THEN
        RETURN v_cached.payload;
    ELSE
        RETURN NULL;
    END IF;
END;
$$;

-- C) rpc_set_agg_cache: Internal setter for cache
CREATE OR REPLACE FUNCTION public.rpc_set_agg_cache(
    p_cache_key text,
    p_scope text,
    p_payload jsonb,
    p_ttl_seconds int,
    p_cell_id uuid DEFAULT NULL,
    p_neighborhood_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.eco_agg_cache (
        cache_key, scope, payload, ttl_seconds, cell_id, neighborhood_id, expires_at
    )
    VALUES (
        p_cache_key, p_scope, p_payload, p_ttl_seconds, p_cell_id, p_neighborhood_id, now() + (p_ttl_seconds || ' seconds')::interval
    )
    ON CONFLICT (cache_key) DO UPDATE SET
        payload = EXCLUDED.payload,
        ttl_seconds = EXCLUDED.ttl_seconds,
        computed_at = now(),
        expires_at = EXCLUDED.expires_at;
END;
$$;

-- D) rpc_purge_expired_cache: Cleanup routine
CREATE OR REPLACE FUNCTION public.rpc_purge_expired_cache()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count int;
BEGIN
    DELETE FROM public.eco_agg_cache WHERE expires_at < now();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
