-- ============================================
-- Deductions are an admin power
-- ============================================
-- Point deductions are ordinary roster_scores rows with negative points. No
-- schema change was needed to allow them — `points` is a plain INTEGER and the
-- standings just sum it — but who may write one does need narrowing.
--
-- migrate_volunteer_event_writes.sql gave volunteers a blanket FOR ALL on
-- roster_scores so the team-event recorder could write its computed rows. That
-- also handed them deductions, and it let them delete any row they liked,
-- including a penalty charged against their own team. Deductions are meant to
-- be an admin decision, so this splits that one policy into per-command ones
-- and adds the sign as a condition:
--
--   INSERT  volunteers may only write rows worth 0 or more
--   UPDATE  volunteers may neither turn a row negative nor edit one that is
--   DELETE  volunteers may not remove a negative row
--
-- Admins keep the lot. Reads are untouched (roster_scores stays publicly
-- readable — the leaderboard is built from it).
--
-- Nothing legitimate is lost: every team-event score is a placement or a tally,
-- so the recorder only ever writes positive rows. The wager escrow does write
-- negative rows (-1 stakes) but place_wager/settle_wagers/void_wagers are all
-- SECURITY DEFINER and bypass RLS entirely.
--
-- Safe to run more than once: policies are dropped and recreated.
-- ============================================

BEGIN;

-- Admin, specifically — as opposed to is_event_recorder(), which is admins and
-- volunteers together.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- The blanket write policies this replaces, under both names they've had.
DROP POLICY IF EXISTS "Recorders manage roster scores" ON public.roster_scores;
DROP POLICY IF EXISTS "Admins manage roster scores" ON public.roster_scores;

DROP POLICY IF EXISTS "Recorders add roster scores" ON public.roster_scores;
CREATE POLICY "Recorders add roster scores" ON public.roster_scores
  FOR INSERT WITH CHECK (
    public.is_event_recorder() AND (public.is_admin() OR points >= 0)
  );

-- USING covers the row as it stands, WITH CHECK the row as it would become —
-- both are needed, or a volunteer could flip a penalty into a reward.
DROP POLICY IF EXISTS "Recorders change roster scores" ON public.roster_scores;
CREATE POLICY "Recorders change roster scores" ON public.roster_scores
  FOR UPDATE
  USING (public.is_event_recorder() AND (public.is_admin() OR points >= 0))
  WITH CHECK (public.is_event_recorder() AND (public.is_admin() OR points >= 0));

DROP POLICY IF EXISTS "Recorders remove roster scores" ON public.roster_scores;
CREATE POLICY "Recorders remove roster scores" ON public.roster_scores
  FOR DELETE USING (
    public.is_event_recorder() AND (public.is_admin() OR points >= 0)
  );

COMMIT;
