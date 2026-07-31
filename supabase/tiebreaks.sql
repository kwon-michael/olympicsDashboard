-- ============================================
-- Tiebreaks — external tiebreaker game results
-- ============================================
-- When two or more teams finish level on a leaderboard, the tie is settled by a
-- game played *outside* the app (a race, rock-paper-scissors, whatever). The
-- admin records the finishing order here and the app applies it as a placement
-- order only.
--
-- Deliberately NOT a points adjustment: nothing in this table touches
-- roster_scores or solo_results, so a team's point total is exactly what it was
-- before the tiebreaker. The original leaderboard stays intact and visible; a
-- resolution only decides who is listed first among teams already level.
--
-- Matching a stored row to a live tie
-- -----------------------------------
-- A resolution is keyed by (board, team_key) where team_key is the *sorted*
-- team-id list. It applies whenever exactly that set of teams is tied on that
-- board — regardless of what rank the tie sits at or how many points they're
-- level on. That way:
--   * both tied teams gaining a point each keeps the resolution valid,
--   * the tie sliding from 2nd to 3rd keeps it valid,
--   * a third team joining the tie changes the set, so the old row stops
--     applying and the admin is asked to settle the new tie.
-- Rows that no longer match any live tie are harmless; the admin panel shows
-- them as inactive so they can be cleared out.
--
-- `tied_rank` / `tied_points` are informational snapshots of the tie as it stood
-- when it was recorded, shown in the admin history.
--
-- Safe to run more than once.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tiebreaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Which leaderboard the tie was on: the main team standings or the solo board.
  board TEXT NOT NULL CHECK (board IN ('teams', 'solo')),
  -- Sorted team-id list, comma separated. Identifies *which* tie this settles.
  team_key TEXT NOT NULL,
  -- The finishing order from the external game: index 0 placed first. Holds the
  -- same ids as team_key, in result order rather than sorted order.
  team_ids UUID[] NOT NULL,
  -- Snapshot of the tie when it was recorded (informational only).
  tied_rank INT NOT NULL,
  tied_points INT NOT NULL,
  -- What was played, e.g. "Rock-paper-scissors, best of 3".
  note TEXT,
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- At least two teams, and team_ids must match team_key's membership.
  CONSTRAINT tiebreaks_min_teams CHECK (array_length(team_ids, 1) >= 2),
  -- One live resolution per tie per board.
  UNIQUE (board, team_key)
);

CREATE INDEX IF NOT EXISTS idx_tiebreaks_board ON public.tiebreaks(board);

ALTER TABLE public.tiebreaks ENABLE ROW LEVEL SECURITY;

-- Readable by everyone: the public leaderboard needs it to order tied teams and
-- to show the tiebreak indicator. Writes are admin-only.
DROP POLICY IF EXISTS "Tiebreaks readable" ON public.tiebreaks;
DROP POLICY IF EXISTS "Admins manage tiebreaks" ON public.tiebreaks;

CREATE POLICY "Tiebreaks readable" ON public.tiebreaks
  FOR SELECT USING (true);
CREATE POLICY "Admins manage tiebreaks" ON public.tiebreaks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Keep updated_at honest so the admin history shows when an order was corrected.
CREATE OR REPLACE FUNCTION public.trg_tiebreaks_touch() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tiebreaks_touch ON public.tiebreaks;
CREATE TRIGGER tiebreaks_touch
  BEFORE UPDATE ON public.tiebreaks
  FOR EACH ROW EXECUTE FUNCTION public.trg_tiebreaks_touch();

COMMIT;
