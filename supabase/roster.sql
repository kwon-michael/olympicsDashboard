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
-- Teams are identified by color (see src/lib/colors.ts). The color→player-group
-- pairing below is one fixed shuffle; migrate_team_colors.sql re-randomizes an
-- existing database in place.
INSERT INTO public.roster_teams (name, color, sort_order)
SELECT v.name, v.color, v.sort_order
FROM (VALUES
  ('Purple',     '#A855F7', 1),
  ('Orange',     '#F97316', 2),
  ('Grey',       '#6B7280', 3),
  ('Red',        '#EF4444', 4),
  ('Light Blue', '#38BDF8', 5),
  ('Yellow',     '#FACC15', 6),
  ('Pink',       '#EC4899', 7),
  ('Dark Blue',  '#1E40AF', 8),
  ('Green',      '#22C55E', 9)
) AS v(name, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.roster_teams);

WITH p(team_name, name, sort_order) AS (VALUES
  ('Purple','Trinity',1),('Purple','Emma',2),('Purple','Umar',3),('Purple','Ibby',4),('Purple','Cris',5),('Purple','Vico',6),
  ('Orange','Becca',1),('Orange','Kyle',2),('Orange','Paolo',3),('Orange','Josh',4),('Orange','Tommy',5),('Orange','Frank',6),
  ('Grey','Leanne',1),('Grey','Kaylee',2),('Grey','Julian',3),('Grey','Nich',4),('Grey','Jonny',5),('Grey','Jowshe',6),
  ('Red','Marisa',1),('Red','Fawad',2),('Red','Jean-Luc',3),('Red','Miz',4),('Red','Sky',5),('Red','David G',6),
  ('Light Blue','Stephanie',1),('Light Blue','Ricky',2),('Light Blue','Samuel',3),('Light Blue','Derek',4),('Light Blue','Arian',5),('Light Blue','Shyan',6),
  ('Yellow','Jolie',1),('Yellow','Kevin',2),('Yellow','Amir',3),('Yellow','Stanley',4),('Yellow','Ryan',5),('Yellow','Abdel',6),
  ('Pink','Maggie',1),('Pink','Julia',2),('Pink','Cameron',3),('Pink','Tristan',4),('Pink','Jaiden',5),('Pink','Troy',6),
  ('Dark Blue','Sara',1),('Dark Blue','Rachel',2),('Dark Blue','Rouben',3),('Dark Blue','Alex',4),('Dark Blue','Aaron',5),('Dark Blue','Sahand',6),
  ('Green','Vic',1),('Green','Cait',2),('Green','Matthew',3),('Green','Alec',4),('Green','Dylan',5),('Green','Amar',6)
)
INSERT INTO public.roster_players (team_id, name, sort_order)
SELECT t.id, p.name, p.sort_order
FROM p
JOIN public.roster_teams t ON t.name = p.team_name
WHERE NOT EXISTS (SELECT 1 FROM public.roster_players);

COMMIT;
