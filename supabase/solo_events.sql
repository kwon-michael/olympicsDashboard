-- ============================================
-- Solo event results (individual placements → team solo standings)
-- ============================================
-- Each of the 9 roster teams enters exactly ONE participant per solo event, so a
-- solo result is really a per-team result. Admins record the raw measurement
-- (time / distance / points) for each team; the app ranks the teams per event
-- and awards placement points (1st = 7, 2nd = 5, 3rd = 3, 4th = 2, 5th = 1,
-- below = 0). These solo points accumulate into a separate SOLO team leaderboard
-- and NEVER mix into the team-event totals — the only crossover is that the top
-- 3 solo teams each earn +1 team-event point and a wildcard "priority" marker.
--
-- Kept deliberately separate from roster_scores (the manual team-event points).
-- Safe to run more than once: table uses IF NOT EXISTS and policies are dropped
-- and recreated.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.solo_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- One of the solo event slugs from src/lib/events.ts (e.g. '100m', 'shotput').
  event_slug TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  -- Which team member competed (optional — shown on the event leaderboard).
  player_id UUID REFERENCES public.roster_players(id) ON DELETE SET NULL,
  -- Raw result stored as an integer in the event's unit:
  --   time     → centiseconds (12.34s → 1234)
  --   distance → centimeters  (3.45m  → 345)
  --   points   → raw integer
  value INTEGER NOT NULL,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One result per team per event.
  UNIQUE (event_slug, team_id)
);

CREATE INDEX IF NOT EXISTS idx_solo_results_event ON public.solo_results(event_slug);
CREATE INDEX IF NOT EXISTS idx_solo_results_team ON public.solo_results(team_id);

-- ----------------------------------------------------------------------------
-- Row level security: public read, admin write (same pattern as roster_*).
-- ----------------------------------------------------------------------------
ALTER TABLE public.solo_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo results readable" ON public.solo_results;
DROP POLICY IF EXISTS "Admins manage solo results" ON public.solo_results;

CREATE POLICY "Solo results readable" ON public.solo_results
  FOR SELECT USING (true);
CREATE POLICY "Admins manage solo results" ON public.solo_results
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

COMMIT;
