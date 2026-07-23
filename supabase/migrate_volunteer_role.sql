-- ============================================
-- Migration: volunteer role
-- Adds a "volunteer" role that can sign in and reach a limited set of admin
-- tools (Solo Events, Tug of War, Dodgeball). Volunteers are appointed by any
-- admin from the Player Management page.
-- ============================================

-- 1. Allow 'volunteer' in the role CHECK constraint.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('participant', 'volunteer', 'admin'));

-- 2. Let admins update any profile so they can change roles from the UI. The
--    existing "Users can update own profile" policy only covers self-updates;
--    without this an admin can't touch another user's row. The role change is
--    still authorized by the enforce_role_change() trigger.
DROP POLICY IF EXISTS "Admins can update any profile" ON public.users;
CREATE POLICY "Admins can update any profile" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );
