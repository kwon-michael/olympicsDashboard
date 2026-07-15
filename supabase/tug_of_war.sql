-- ============================================
-- Tug of War tournament (groups + playoff bracket)
-- ============================================
-- A standalone tournament layered on top of the roster teams. After the solo
-- events finish, the team standings are snapshotted and split into three groups
-- of three (rank {1,4,7} -> A, {2,5,8} -> B, {3,6,9} -> C). Each group plays a
-- round robin (best-of-3 matches, round wins tracked). The winner of each group
-- plus the best of the three 2nd-place teams advance to a randomized 4-team
-- bracket (semifinals -> final + 3rd-place match).
--
-- This is display/tracking only: final placement points (5/3/2/1) are still
-- awarded through the normal roster score tools. Only admins can write; anyone
-- can read.
--
-- Safe to run more than once: tables use IF NOT EXISTS and policies are dropped
-- and recreated. The single tug_state row is seeded only when absent.
-- ============================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- Single-row tournament state (id is pinned to 1).
CREATE TABLE IF NOT EXISTS public.tug_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  groups_locked BOOLEAN NOT NULL DEFAULT false,
  bracket_seeded BOOLEAN NOT NULL DEFAULT false,
  -- Set by an admin to break a 2nd-place tie for the final wildcard spot after
  -- the tiebreaker game is played in real life.
  wildcard_team_id UUID REFERENCES public.roster_teams(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Which group each team belongs to, plus the solo-standings seed (1-9) it was
-- assigned at lock time.
CREATE TABLE IF NOT EXISTS public.tug_group_members (
  team_id UUID PRIMARY KEY REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  group_label TEXT NOT NULL,          -- 'A' | 'B' | 'C'
  seed INT NOT NULL,                  -- solo-standings position 1-9
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every match: group round-robin matches and the 4 bracket matches.
CREATE TABLE IF NOT EXISTS public.tug_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage TEXT NOT NULL,                -- 'group' | 'semi' | 'final' | 'third'
  group_label TEXT,                   -- 'A'|'B'|'C' for group stage, NULL for bracket
  slot INT NOT NULL DEFAULT 0,        -- ordering within a stage
  team_a UUID REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  team_b UUID REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  score_a INT,                        -- round wins for team_a
  score_b INT,                        -- round wins for team_b
  winner_id UUID REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  is_tiebreaker BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tug_matches_stage ON public.tug_matches(stage);
CREATE INDEX IF NOT EXISTS idx_tug_group_members_group ON public.tug_group_members(group_label);

-- ----------------------------------------------------------------------------
-- Row level security: public read, admin write
-- ----------------------------------------------------------------------------
ALTER TABLE public.tug_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tug_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tug_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tug state readable" ON public.tug_state;
DROP POLICY IF EXISTS "Admins manage tug state" ON public.tug_state;
DROP POLICY IF EXISTS "Tug groups readable" ON public.tug_group_members;
DROP POLICY IF EXISTS "Admins manage tug groups" ON public.tug_group_members;
DROP POLICY IF EXISTS "Tug matches readable" ON public.tug_matches;
DROP POLICY IF EXISTS "Admins manage tug matches" ON public.tug_matches;

CREATE POLICY "Tug state readable" ON public.tug_state
  FOR SELECT USING (true);
CREATE POLICY "Admins manage tug state" ON public.tug_state
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Tug groups readable" ON public.tug_group_members
  FOR SELECT USING (true);
CREATE POLICY "Admins manage tug groups" ON public.tug_group_members
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Tug matches readable" ON public.tug_matches
  FOR SELECT USING (true);
CREATE POLICY "Admins manage tug matches" ON public.tug_matches
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------------------
-- Seed the single state row (only when absent)
-- ----------------------------------------------------------------------------
INSERT INTO public.tug_state (id, groups_locked, bracket_seeded)
SELECT 1, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.tug_state);

COMMIT;
