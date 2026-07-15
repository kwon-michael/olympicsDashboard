-- ============================================
-- Migration: restrict activity logs to the owner account
-- Run once against an existing database.
--
-- Any admin may still GENERATE log entries (INSERT is unchanged), but only the
-- owner (kwon.mike90@gmail.com) can read or clear them. This mirrors the
-- app-level gate in the middleware / admin UI.
-- ============================================

BEGIN;

-- audit_log: replace the admin-wide SELECT/DELETE policies with owner-only ones.
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can delete audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Owner can view audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Owner can delete audit log" ON public.audit_log;

CREATE POLICY "Owner can view audit log" ON public.audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

CREATE POLICY "Owner can delete audit log" ON public.audit_log
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

-- user_activity: same treatment (INSERT policy left untouched).
DROP POLICY IF EXISTS "Admins can view user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Admins can delete user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Owner can view user activity" ON public.user_activity;
DROP POLICY IF EXISTS "Owner can delete user activity" ON public.user_activity;

CREATE POLICY "Owner can view user activity" ON public.user_activity
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

CREATE POLICY "Owner can delete user activity" ON public.user_activity
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

COMMIT;
