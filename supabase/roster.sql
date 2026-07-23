-- ============================================
-- Roster + manual scoring (auth-free participants)
-- ============================================
-- Teams and players live here as plain data — NOT tied to auth accounts.
-- Only admins (authenticated users with role='admin') can edit; everyone can
-- read. Scores are simple manual point entries attached to a team and,
-- optionally, an individual player. Player points roll up into their team's
-- total; individual totals also drive an MVP leaderboard.
--
-- Safe to run more than once: tables use IF NOT EXISTS, policies are dropped
-- and recreated, and the seed only inserts when the tables are empty.
-- ============================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roster_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#E94560',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roster_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true, -- false = "crossed out"
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roster_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  -- NULL player_id = a team-level score; otherwise an individual's score
  -- (which also counts toward the team via team_id).
  player_id UUID REFERENCES public.roster_players(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  points INTEGER NOT NULL,
  -- Optional raw inputs behind a computed team-event total (see
  -- /admin/team-events). NULL for plain manual scores.
  metadata JSONB,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Older databases created before the recorder existed pick up the column here.
ALTER TABLE public.roster_scores ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_roster_players_team ON public.roster_players(team_id);
CREATE INDEX IF NOT EXISTS idx_roster_scores_team ON public.roster_scores(team_id);
CREATE INDEX IF NOT EXISTS idx_roster_scores_player ON public.roster_scores(player_id);

-- ----------------------------------------------------------------------------
-- Row level security: public read, admin write
-- ----------------------------------------------------------------------------
ALTER TABLE public.roster_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Roster teams readable" ON public.roster_teams;
DROP POLICY IF EXISTS "Admins manage roster teams" ON public.roster_teams;
DROP POLICY IF EXISTS "Roster players readable" ON public.roster_players;
DROP POLICY IF EXISTS "Admins manage roster players" ON public.roster_players;
DROP POLICY IF EXISTS "Roster scores readable" ON public.roster_scores;
DROP POLICY IF EXISTS "Admins manage roster scores" ON public.roster_scores;

CREATE POLICY "Roster teams readable" ON public.roster_teams
  FOR SELECT USING (true);
CREATE POLICY "Admins manage roster teams" ON public.roster_teams
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Roster players readable" ON public.roster_players
  FOR SELECT USING (true);
CREATE POLICY "Admins manage roster players" ON public.roster_players
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Roster scores readable" ON public.roster_scores
  FOR SELECT USING (true);
CREATE POLICY "Admins manage roster scores" ON public.roster_scores
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------------------
-- Seed (only when empty)
-- ----------------------------------------------------------------------------
INSERT INTO public.roster_teams (name, color, sort_order)
SELECT v.name, v.color, v.sort_order
FROM (VALUES
  ('Team 1', '#E94560', 1),
  ('Team 2', '#3B82F6', 2),
  ('Team 3', '#22C55E', 3),
  ('Team 4', '#F59E0B', 4),
  ('Team 5', '#A855F7', 5),
  ('Team 6', '#EF4444', 6),
  ('Team 7', '#14B8A6', 7),
  ('Team 8', '#EC4899', 8),
  ('Team 9', '#6366F1', 9)
) AS v(name, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.roster_teams);

WITH p(team_name, name, sort_order) AS (VALUES
  ('Team 1','Trinity',1),('Team 1','Emma',2),('Team 1','Umar',3),('Team 1','Ibby',4),('Team 1','Cris',5),('Team 1','Vico',6),
  ('Team 2','Becca',1),('Team 2','Kyle',2),('Team 2','Paolo',3),('Team 2','Josh',4),('Team 2','Tommy',5),('Team 2','Frank',6),
  ('Team 3','Leanne',1),('Team 3','Kaylee',2),('Team 3','Julian',3),('Team 3','Nich',4),('Team 3','Jonny',5),('Team 3','Jowshe',6),
  ('Team 4','Marisa',1),('Team 4','Fawad',2),('Team 4','Jean-Luc',3),('Team 4','Miz',4),('Team 4','Sky',5),('Team 4','David G',6),
  ('Team 5','Stephanie',1),('Team 5','Ricky',2),('Team 5','Samuel',3),('Team 5','Derek',4),('Team 5','Arian',5),('Team 5','Shyan',6),
  ('Team 6','Jolie',1),('Team 6','Kevin',2),('Team 6','Amir',3),('Team 6','Stanley',4),('Team 6','Ryan',5),('Team 6','Abdel',6),
  ('Team 7','Maggie',1),('Team 7','Julia',2),('Team 7','Cameron',3),('Team 7','Tristan',4),('Team 7','Jaiden',5),('Team 7','Troy',6),
  ('Team 8','Sara',1),('Team 8','Rachel',2),('Team 8','Rouben',3),('Team 8','Alex',4),('Team 8','Aaron',5),('Team 8','Sahand',6),
  ('Team 9','Vic',1),('Team 9','Cait',2),('Team 9','Matthew',3),('Team 9','Alec',4),('Team 9','Dylan',5),('Team 9','Amar',6)
)
INSERT INTO public.roster_players (team_id, name, sort_order)
SELECT t.id, p.name, p.sort_order
FROM p
JOIN public.roster_teams t ON t.name = p.team_name
WHERE NOT EXISTS (SELECT 1 FROM public.roster_players);

COMMIT;
