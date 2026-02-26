-- A7: Base VR (route windows + recurrence + partner anchors)

CREATE TABLE IF NOT EXISTS public.route_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INT NOT NULL DEFAULT 20 CHECK (capacity > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_windows_neighborhood_weekday_active
  ON public.route_windows (neighborhood_id, weekday, active);

ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS route_window_id UUID REFERENCES public.route_windows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_id UUID,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.recurring_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('resident', 'partner')),
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'biweekly')),
  preferred_weekday INT NOT NULL CHECK (preferred_weekday >= 0 AND preferred_weekday <= 6),
  preferred_window_id UUID REFERENCES public.route_windows(id) ON DELETE SET NULL,
  address_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pickup_requests_subscription_id_fkey'
  ) THEN
    ALTER TABLE public.pickup_requests
      ADD CONSTRAINT pickup_requests_subscription_id_fkey
      FOREIGN KEY (subscription_id) REFERENCES public.recurring_subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.partner_anchors (
  partner_id UUID PRIMARY KEY REFERENCES public.partners(id) ON DELETE CASCADE,
  anchor_level TEXT NOT NULL CHECK (anchor_level IN ('bronze', 'prata', 'ouro')),
  pickup_volume_hint TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_subscriptions_created_by_status
  ON public.recurring_subscriptions (created_by, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recurring_subscriptions_neighborhood
  ON public.recurring_subscriptions (neighborhood_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.eco_mark_request_recurring()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_id IS NOT NULL THEN
    NEW.is_recurring := true;
    RETURN NEW;
  END IF;

  NEW.is_recurring := EXISTS (
    SELECT 1
    FROM public.recurring_subscriptions rs
    WHERE rs.created_by = NEW.created_by
      AND rs.neighborhood_id = NEW.neighborhood_id
      AND rs.status = 'active'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pickup_requests_mark_recurring ON public.pickup_requests;
CREATE TRIGGER tr_pickup_requests_mark_recurring
BEFORE INSERT ON public.pickup_requests
FOR EACH ROW
EXECUTE FUNCTION public.eco_mark_request_recurring();

ALTER TABLE public.route_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_anchors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Route windows are public read" ON public.route_windows;
CREATE POLICY "Route windows are public read"
ON public.route_windows
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Operators manage route windows" ON public.route_windows;
CREATE POLICY "Operators manage route windows"
ON public.route_windows
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Subscription owners read own" ON public.recurring_subscriptions;
CREATE POLICY "Subscription owners read own"
ON public.recurring_subscriptions
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Subscription owners insert own" ON public.recurring_subscriptions;
CREATE POLICY "Subscription owners insert own"
ON public.recurring_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Subscription owners update own" ON public.recurring_subscriptions;
CREATE POLICY "Subscription owners update own"
ON public.recurring_subscriptions
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Subscription owners delete own" ON public.recurring_subscriptions;
CREATE POLICY "Subscription owners delete own"
ON public.recurring_subscriptions
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Operators manage subscriptions" ON public.recurring_subscriptions;
CREATE POLICY "Operators manage subscriptions"
ON public.recurring_subscriptions
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Partner anchors public read" ON public.partner_anchors;
CREATE POLICY "Partner anchors public read"
ON public.partner_anchors
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Operators manage partner anchors" ON public.partner_anchors;
CREATE POLICY "Operators manage partner anchors"
ON public.partner_anchors
FOR ALL
TO authenticated
USING (public.has_role(ARRAY['operator'::public.app_role]))
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Partners are public read" ON public.partners;
CREATE POLICY "Partners are public read"
ON public.partners
FOR SELECT
TO authenticated
USING (true);

NOTIFY pgrst, 'reload schema';
