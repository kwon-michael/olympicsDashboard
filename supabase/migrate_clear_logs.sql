-- ============================================
-- Migration: allow admins to clear the activity logs
-- Run once against an existing database.
-- ============================================

CREATE POLICY "Admins can delete audit log" ON public.audit_log
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete user activity" ON public.user_activity
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
