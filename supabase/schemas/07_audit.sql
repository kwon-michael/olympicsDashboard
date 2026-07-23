-- ============================================
-- AUDIT LOG TABLE (Admin Actions)
-- ============================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- actor_id goes NULL (ON DELETE SET NULL) when the acting account is removed;
  -- actor_name snapshots the display name so the trail stays readable after
  -- deletion. The name is filled by the set_audit_actor_name trigger below.
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB,
  -- Revert support: an entry is revertible when it carries the real target
  -- table + row id plus a snapshot of the row state. `before` restores the row
  -- (update/delete); `after` is kept for reference/conflict-checking (create/update).
  table_name TEXT,
  row_id TEXT,
  before JSONB,
  after JSONB,
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Viewing/clearing the logs is restricted to the single owner account, even
-- though any admin may generate log entries (see INSERT policy).
CREATE POLICY "Owner can view audit log" ON public.audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

CREATE POLICY "Admins can insert audit log" ON public.audit_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Only the owner may mark an entry reverted (sets reverted_at / reverted_by).
CREATE POLICY "Owner can update audit log" ON public.audit_log
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

CREATE POLICY "Owner can delete audit log" ON public.audit_log
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

-- ============================================
-- USER ACTIVITY LOG TABLE
-- ============================================
CREATE TABLE public.user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- user_id goes NULL (ON DELETE SET NULL) when the account is removed;
  -- user_name snapshots the display name so the entry stays readable after
  -- deletion. The name is filled by the set_activity_user_name trigger below.
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view user activity" ON public.user_activity
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

CREATE POLICY "Any authenticated user can insert own activity" ON public.user_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner can delete user activity" ON public.user_activity
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND lower(email) = 'kwon.mike90@gmail.com')
  );

-- ============================================
-- ACTOR/USER NAME SNAPSHOTS
-- ============================================
-- Capture the acting account's display name onto each log row at insert time so
-- the trail survives account deletion (when actor_id/user_id are set to NULL).
CREATE OR REPLACE FUNCTION public.set_audit_actor_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actor_name IS NULL AND NEW.actor_id IS NOT NULL THEN
    SELECT display_name INTO NEW.actor_name
    FROM public.users WHERE id = NEW.actor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_log_set_actor_name
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_actor_name();

CREATE OR REPLACE FUNCTION public.set_activity_user_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_name IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT display_name INTO NEW.user_name
    FROM public.users WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER user_activity_set_user_name
  BEFORE INSERT ON public.user_activity
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_user_name();
