-- A6.1 fix: allow service_role bootstrap/setup flows while keeping resident guardrails.

CREATE OR REPLACE FUNCTION public.validate_pickup_request_guardrails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role public.app_role;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

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

NOTIFY pgrst, 'reload schema';
