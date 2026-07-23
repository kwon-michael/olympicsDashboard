-- ============================================
-- Migration: revert support for audit_log
-- Adds snapshot columns so admin actions recorded going forward can be
-- reverted from the Activity Logs page. Historical rows (created before this
-- migration) have NULL snapshots and are therefore not revertible.
-- ============================================

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS table_name  TEXT,
  ADD COLUMN IF NOT EXISTS row_id      TEXT,
  ADD COLUMN IF NOT EXISTS before      JSONB,
  ADD COLUMN IF NOT EXISTS after       JSONB,
  ADD COLUMN IF NOT EXISTS reverted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reverted_by UUID REFERENCES public.users(id);

-- Only the owner may mark an entry reverted (sets reverted_at / reverted_by).
DROP POLICY IF EXISTS "Owner can update audit log" ON public.audit_log;
CREATE POLICY "Owner can update audit log" ON public.audit_log
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );
