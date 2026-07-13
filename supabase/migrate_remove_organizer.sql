-- ============================================
-- Migration: remove the 'organizer' role, revert to admin-only
-- Run once against an existing database. Safe whether or not the earlier
-- organizer migration was applied (uses IF EXISTS / no-op updates).
-- ============================================

-- 1. Promote any existing organizers to admin. Drop the role-change guard
--    first so the bulk update isn't blocked, then recreate it at the end.
DROP TRIGGER IF EXISTS trigger_enforce_role_change ON public.users;
UPDATE public.users SET role = 'admin' WHERE role = 'organizer';

-- 2. Restrict the role constraint to participant/admin.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('participant', 'admin'));

-- 3. Revert every role-gated policy to admin-only.

-- Teams
DROP POLICY IF EXISTS "Admins can update any team" ON public.teams;
CREATE POLICY "Admins can update any team" ON public.teams
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;
CREATE POLICY "Admins can delete teams" ON public.teams
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Events
DROP POLICY IF EXISTS "Admins can create events" ON public.events;
CREATE POLICY "Admins can create events" ON public.events
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events" ON public.events
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
CREATE POLICY "Admins can delete events" ON public.events
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Scores
DROP POLICY IF EXISTS "Admins can insert scores" ON public.scores;
CREATE POLICY "Admins can insert scores" ON public.scores
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can update scores" ON public.scores;
CREATE POLICY "Admins can update scores" ON public.scores
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete scores" ON public.scores;
CREATE POLICY "Admins can delete scores" ON public.scores
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Announcements
DROP POLICY IF EXISTS "Admins can create announcements" ON public.announcements;
CREATE POLICY "Admins can create announcements" ON public.announcements
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can update announcements" ON public.announcements;
CREATE POLICY "Admins can update announcements" ON public.announcements
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
CREATE POLICY "Admins can delete announcements" ON public.announcements
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Audit log
DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
CREATE POLICY "Admins can view audit log" ON public.audit_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.audit_log;
CREATE POLICY "Admins can insert audit log" ON public.audit_log
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete audit log" ON public.audit_log;
CREATE POLICY "Admins can delete audit log" ON public.audit_log
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- User activity
DROP POLICY IF EXISTS "Admins can view user activity" ON public.user_activity;
CREATE POLICY "Admins can view user activity" ON public.user_activity
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete user activity" ON public.user_activity;
CREATE POLICY "Admins can delete user activity" ON public.user_activity
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Schedule entries
DROP POLICY IF EXISTS "Admins can create schedule entries" ON public.schedule_entries;
CREATE POLICY "Admins can create schedule entries" ON public.schedule_entries
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can update schedule entries" ON public.schedule_entries;
CREATE POLICY "Admins can update schedule entries" ON public.schedule_entries
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins can delete schedule entries" ON public.schedule_entries;
CREATE POLICY "Admins can delete schedule entries" ON public.schedule_entries
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 4. Recreate the role-change guard (admins / service role only).
CREATE OR REPLACE FUNCTION public.enforce_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_enforce_role_change
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_role_change();
