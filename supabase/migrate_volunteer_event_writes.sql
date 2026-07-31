-- ============================================
-- Let volunteers record results for the events they run
-- ============================================
-- migrate_volunteer_role.sql added the role and the app-level path allowlist
-- (VOLUNTEER_ADMIN_PATHS in src/lib/auth.ts) but never widened a single RLS
-- policy, so the two layers disagreed: a volunteer could open /admin/tug-of-war
-- or /admin/dodgeball and tap a result, and the UPDATE would match zero rows.
-- Postgrest reports that as a successful update of nothing, so the tap appeared
-- to work and the next refetch silently wiped it.
--
-- This grants volunteers write access to exactly the tables behind the four
-- tools they can already open — the two tournaments and the solo results — and
-- nothing else. Rosters, manual scores, the schedule, tiebreaks and the audit
-- log all stay admin-only.
--
-- Scope note: the *_state tables are included because volunteers need to set the
-- wildcard when 2nd place ties. That also lets them lock groups and reset the
-- tournament. If you'd rather keep those two to admins, replace the FOR ALL
-- policies on tug_state / dodgeball_state below with a FOR UPDATE policy naming
-- only wildcard_team_id — but note a reset is already destructive for admins and
-- is behind a confirm prompt for everyone.
--
-- Safe to run more than once: every policy is dropped and recreated.

BEGIN;

-- A volunteer or an admin. Volunteers run the live events; admins can do
-- everything a volunteer can.
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

-- ----------------------------------------------------------------------------
-- Tug of War
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage tug state" ON public.tug_state;
DROP POLICY IF EXISTS "Recorders manage tug state" ON public.tug_state;
CREATE POLICY "Recorders manage tug state" ON public.tug_state
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

DROP POLICY IF EXISTS "Admins manage tug groups" ON public.tug_group_members;
DROP POLICY IF EXISTS "Recorders manage tug groups" ON public.tug_group_members;
CREATE POLICY "Recorders manage tug groups" ON public.tug_group_members
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

DROP POLICY IF EXISTS "Admins manage tug matches" ON public.tug_matches;
DROP POLICY IF EXISTS "Recorders manage tug matches" ON public.tug_matches;
CREATE POLICY "Recorders manage tug matches" ON public.tug_matches
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

-- ----------------------------------------------------------------------------
-- Dodgeball
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage dodgeball state" ON public.dodgeball_state;
DROP POLICY IF EXISTS "Recorders manage dodgeball state" ON public.dodgeball_state;
CREATE POLICY "Recorders manage dodgeball state" ON public.dodgeball_state
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

DROP POLICY IF EXISTS "Admins manage dodgeball groups" ON public.dodgeball_group_members;
DROP POLICY IF EXISTS "Recorders manage dodgeball groups" ON public.dodgeball_group_members;
CREATE POLICY "Recorders manage dodgeball groups" ON public.dodgeball_group_members
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

DROP POLICY IF EXISTS "Admins manage dodgeball matches" ON public.dodgeball_matches;
DROP POLICY IF EXISTS "Recorders manage dodgeball matches" ON public.dodgeball_matches;
CREATE POLICY "Recorders manage dodgeball matches" ON public.dodgeball_matches
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

-- ----------------------------------------------------------------------------
-- Solo events (/admin/solo is on the same volunteer allowlist)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage solo results" ON public.solo_results;
DROP POLICY IF EXISTS "Recorders manage solo results" ON public.solo_results;
CREATE POLICY "Recorders manage solo results" ON public.solo_results
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

-- ----------------------------------------------------------------------------
-- Team-event recorder (/admin/team-events writes computed roster_scores rows)
-- ----------------------------------------------------------------------------
-- Note this is the one grant that reaches a general-purpose table: roster_scores
-- also holds manual points entered in Score Management, which stays admin-only
-- at the route level. A volunteer can therefore write score rows through the
-- recorder but has no tool for editing arbitrary ones.
DROP POLICY IF EXISTS "Admins manage roster scores" ON public.roster_scores;
DROP POLICY IF EXISTS "Recorders manage roster scores" ON public.roster_scores;
CREATE POLICY "Recorders manage roster scores" ON public.roster_scores
  FOR ALL USING (public.is_event_recorder())
  WITH CHECK (public.is_event_recorder());

-- ----------------------------------------------------------------------------
-- Audit trail
-- ----------------------------------------------------------------------------
-- Every write above is logged through logAudit(), and the insert policy was
-- admin-only — so without this a volunteer's results would land with no trail at
-- all. Only the INSERT side is widened: reading, reverting and clearing the log
-- stay restricted to the single owner account.
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Recorders can insert audit log" ON public.audit_log;
CREATE POLICY "Recorders can insert audit log" ON public.audit_log
  FOR INSERT WITH CHECK (public.is_event_recorder());

COMMIT;
