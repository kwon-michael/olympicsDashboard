-- ============================================
-- Preserve the audit trail of deleted accounts
-- ============================================
-- Previously audit_log.actor_id and user_activity.user_id were NOT NULL with a
-- plain foreign key, and the log pages resolve the actor/user name purely by
-- joining back to public.users. That meant removing an account forced its log
-- entries to be deleted (and even if kept, they'd render as "Unknown").
--
-- This migration makes the trail survive account deletion:
--   1. Snapshot the actor/user display name onto each row (actor_name/user_name)
--      via a BEFORE INSERT trigger, and backfill existing rows.
--   2. Make the id columns nullable and switch the FK to ON DELETE SET NULL, so
--      deleting a user blanks the reference but keeps the entry and its name.

-- ---- audit_log -------------------------------------------------------------
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS actor_name TEXT;

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

DROP TRIGGER IF EXISTS audit_log_set_actor_name ON public.audit_log;
CREATE TRIGGER audit_log_set_actor_name
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_actor_name();

-- Backfill names for entries written before this change.
UPDATE public.audit_log a
  SET actor_name = u.display_name
  FROM public.users u
  WHERE a.actor_id = u.id AND a.actor_name IS NULL;

ALTER TABLE public.audit_log ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- ---- user_activity ---------------------------------------------------------
ALTER TABLE public.user_activity ADD COLUMN IF NOT EXISTS user_name TEXT;

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

DROP TRIGGER IF EXISTS user_activity_set_user_name ON public.user_activity;
CREATE TRIGGER user_activity_set_user_name
  BEFORE INSERT ON public.user_activity
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_user_name();

UPDATE public.user_activity a
  SET user_name = u.display_name
  FROM public.users u
  WHERE a.user_id = u.id AND a.user_name IS NULL;

ALTER TABLE public.user_activity ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_activity DROP CONSTRAINT IF EXISTS user_activity_user_id_fkey;
ALTER TABLE public.user_activity
  ADD CONSTRAINT user_activity_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
