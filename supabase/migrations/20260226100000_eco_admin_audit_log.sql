-- A4.2: Audit trail for privileged admin operations.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID NOT NULL REFERENCES public.profiles(user_id),
  action TEXT NOT NULL CHECK (length(trim(action)) > 0),
  target_type TEXT NOT NULL CHECK (target_type IN ('period', 'payout', 'receipt', 'system')),
  target_id UUID,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON public.admin_audit_log(action, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators read admin audit log" ON public.admin_audit_log;
CREATE POLICY "Operators read admin audit log"
ON public.admin_audit_log
FOR SELECT
USING (public.has_role(ARRAY['operator'::public.app_role]));

DROP POLICY IF EXISTS "Operators insert admin audit log" ON public.admin_audit_log;
CREATE POLICY "Operators insert admin audit log"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (public.has_role(ARRAY['operator'::public.app_role]));

NOTIFY pgrst, 'reload schema';
