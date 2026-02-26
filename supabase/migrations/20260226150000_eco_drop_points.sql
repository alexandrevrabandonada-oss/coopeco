-- A7.1: Pontos ECO + fulfillment mode

CREATE TABLE IF NOT EXISTS public.eco_drop_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  address_public TEXT NOT NULL,
  hours TEXT NOT NULL,
  accepted_materials public.material_kind[] NOT NULL DEFAULT ARRAY['paper'::public.material_kind],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.eco_drop_points TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.eco_drop_points TO authenticated;

CREATE INDEX IF NOT EXISTS idx_eco_drop_points_neighborhood_active
  ON public.eco_drop_points (neighborhood_id, active, created_at DESC);

ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT NOT NULL DEFAULT 'doorstep' CHECK (fulfillment_mode IN ('doorstep', 'drop_point')),
  ADD COLUMN IF NOT EXISTS drop_point_id UUID REFERENCES public.eco_drop_points(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pickup_requests_fulfillment_mode
  ON public.pickup_requests (fulfillment_mode, neighborhood_id, status, created_at DESC);

ALTER TABLE public.eco_drop_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eco drop points public read" ON public.eco_drop_points;
CREATE POLICY "Eco drop points public read"
ON public.eco_drop_points
FOR SELECT
TO PUBLIC
USING (true);

DROP POLICY IF EXISTS "Operators manage eco drop points" ON public.eco_drop_points;
CREATE POLICY "Operators manage eco drop points"
ON public.eco_drop_points
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

CREATE OR REPLACE FUNCTION public.validate_pickup_request_fulfillment_mode()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fulfillment_mode = 'drop_point' THEN
    IF NEW.drop_point_id IS NULL THEN
      RAISE EXCEPTION 'drop_point_required';
    END IF;
  ELSE
    NEW.drop_point_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pickup_request_fulfillment_mode ON public.pickup_requests;
CREATE TRIGGER tr_pickup_request_fulfillment_mode
BEFORE INSERT OR UPDATE ON public.pickup_requests
FOR EACH ROW
EXECUTE FUNCTION public.validate_pickup_request_fulfillment_mode();

NOTIFY pgrst, 'reload schema';
