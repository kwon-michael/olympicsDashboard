-- ============================================
-- Arrival check-in (the registration desk)
-- ============================================
-- One row per roster player who has physically shown up. Presence *is* the
-- state: a row means "arrived", deleting it means "not here yet". That keeps the
-- desk UI a plain toggle with nothing to reconcile, and it's why there's no
-- boolean column — an absent row and a `false` row would mean the same thing.
--
-- Deliberately a separate table rather than a column on roster_players:
-- volunteers work the door, but the roster itself (moving players, crossing them
-- out, renaming) stays admin-only. RLS can't grant write access to *some*
-- columns of a table, so a check-in column on roster_players would have handed
-- volunteers the whole roster. This table is the only thing they can write.
--
-- Not publicly readable, unlike scores and rosters. Who has and hasn't arrived
-- is attendance data about named individuals and nothing on the public site
-- needs it, so reads are limited to the same admins and volunteers who record
-- it.
--
-- Safe to run more than once: the table uses IF NOT EXISTS, the policy is
-- dropped and recreated, and the publication add swallows a duplicate.
-- ============================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roster_checkins (
  -- PK, not just a FK: a player is either here or not, so one row is the most
  -- they can ever have. It also makes the check-in an idempotent upsert, which
  -- matters when two volunteers tap the same name at the same moment.
  player_id UUID PRIMARY KEY REFERENCES public.roster_players(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Who worked the door. SET NULL so removing a volunteer's account later
  -- doesn't take the arrival record with it.
  checked_in_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- Row level security: admins and volunteers only, read and write
-- ----------------------------------------------------------------------------
ALTER TABLE public.roster_checkins ENABLE ROW LEVEL SECURITY;

-- Same helper migrate_volunteer_event_writes.sql defines; repeated here so this
-- file can be run on its own. Volunteers run the live events and the door;
-- admins can do everything a volunteer can.
CREATE OR REPLACE FUNCTION public.is_event_recorder()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'volunteer')
  );
$$;

-- FOR ALL covers SELECT too — that's the point, there is no public read policy.
DROP POLICY IF EXISTS "Recorders manage check-ins" ON public.roster_checkins;
CREATE POLICY "Recorders manage check-ins" ON public.roster_checkins
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
-- Several volunteers work the door at once on different phones; without this
-- each of them sees a stale list and re-taps names someone else already did.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.roster_checkins;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
