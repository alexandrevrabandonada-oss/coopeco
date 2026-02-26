-- A6.1: request creation guardrails + insert policies for real user flow.

CREATE TABLE IF NOT EXISTS public.request_rate_limits (
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.request_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators read request rate limits" ON public.request_rate_limits;
CREATE POLICY "Operators read request rate limits"
ON public.request_rate_limits
FOR SELECT
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]));

CREATE OR REPLACE FUNCTION public.eco_can_create_request()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_count INT := 0;
  limit_per_day CONSTANT INT := 10;
BEGIN
  IF actor_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.request_rate_limits (user_id, day, count, updated_at)
  VALUES (actor_id, CURRENT_DATE, 1, now())
  ON CONFLICT (user_id, day)
  DO UPDATE
  SET
    count = public.request_rate_limits.count + 1,
    updated_at = now()
  RETURNING count INTO actor_count;

  RETURN actor_count <= limit_per_day;
END;
$$;

REVOKE ALL ON FUNCTION public.eco_can_create_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eco_can_create_request() TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_pickup_request_guardrails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'created_by_mismatch';
  END IF;

  SELECT p.role
    INTO actor_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'missing_profile';
  END IF;

  IF actor_role = 'resident'::public.app_role AND NOT public.eco_can_create_request() THEN
    RAISE EXCEPTION 'rate_limit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pickup_request_guardrails ON public.pickup_requests;
CREATE TRIGGER tr_pickup_request_guardrails
BEFORE INSERT ON public.pickup_requests
FOR EACH ROW
EXECUTE FUNCTION public.validate_pickup_request_guardrails();

ALTER TABLE public.pickup_request_items
DROP CONSTRAINT IF EXISTS pickup_request_items_qty_check;

ALTER TABLE public.pickup_request_items
DROP CONSTRAINT IF EXISTS ck_pickup_request_items_qty_guardrail;

ALTER TABLE public.pickup_request_items
ADD CONSTRAINT ck_pickup_request_items_qty_guardrail
CHECK (qty > 0 AND qty <= 50);

CREATE OR REPLACE FUNCTION public.validate_pickup_request_item_guardrails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_items INT := 0;
BEGIN
  IF NEW.qty IS NULL OR NEW.qty <= 0 OR NEW.qty > 50 THEN
    RAISE EXCEPTION 'item_qty_limit';
  END IF;

  SELECT count(*)
    INTO existing_items
  FROM public.pickup_request_items i
  WHERE i.request_id = NEW.request_id;

  IF existing_items >= 12 THEN
    RAISE EXCEPTION 'item_limit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pickup_request_item_guardrails ON public.pickup_request_items;
CREATE TRIGGER tr_pickup_request_item_guardrails
BEFORE INSERT ON public.pickup_request_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_pickup_request_item_guardrails();

DROP POLICY IF EXISTS "Users create own pickup requests" ON public.pickup_requests;
CREATE POLICY "Users create own pickup requests"
ON public.pickup_requests
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND neighborhood_id IS NOT NULL
  AND public.has_role(
    ARRAY[
      'resident'::public.app_role,
      'cooperado'::public.app_role,
      'operator'::public.app_role
    ]
  )
);

DROP POLICY IF EXISTS "Creators insert own request items" ON public.pickup_request_items;
CREATE POLICY "Creators insert own request items"
ON public.pickup_request_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pickup_requests pr
    WHERE pr.id = request_id
      AND pr.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Creators insert private for own requests" ON public.pickup_request_private;
CREATE POLICY "Creators insert private for own requests"
ON public.pickup_request_private
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pickup_requests pr
    WHERE pr.id = request_id
      AND pr.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Cooperados create own assignments for open requests" ON public.pickup_assignments;
CREATE POLICY "Cooperados create own assignments for open requests"
ON public.pickup_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  cooperado_id = auth.uid()
  AND public.has_role(
    ARRAY[
      'cooperado'::public.app_role,
      'operator'::public.app_role
    ]
  )
  AND EXISTS (
    SELECT 1
    FROM public.pickup_requests pr
    LEFT JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE pr.id = request_id
      AND pr.status = 'open'
      AND (
        public.has_role(ARRAY['operator'::public.app_role])
        OR (
          p.neighborhood_id IS NOT NULL
          AND pr.neighborhood_id = p.neighborhood_id
        )
      )
  )
);

NOTIFY pgrst, 'reload schema';
