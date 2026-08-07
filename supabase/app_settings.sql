-- ============================================
-- App settings — single-row, admin-controlled site switches
-- ============================================
-- One row (id pinned to 1) holding flags that change what the public site
-- shows. Today that's just `leaderboard_hidden`, the switch an admin flips to
-- take the standings off the public pages during the event (so the finish is a
-- reveal rather than a running commentary).
--
-- Scoring is deliberately untouched by this flag: points keep being recorded,
-- deducted and recomputed exactly as before, and admins keep seeing the live
-- board. The flag only decides whether the public pages render the standings or
-- a "hidden" message in their place — see src/lib/settings.ts.
--
-- This is a presentation switch, not a security boundary. The underlying score
-- rows (roster_scores, solo_results, the two tournaments) stay publicly readable
-- because the whole app is built on anonymous reads, so someone querying the API
-- directly could still add the points up themselves. Hiding the data itself
-- would mean locking those tables down, which would also take them away from the
-- public rules/schedule pages that legitimately use them.
--
-- Publicly readable for the same reason: every visitor's browser has to know
-- whether the board is hidden before it can decide what to render.
--
-- Safe to run more than once: the table uses IF NOT EXISTS, policies are dropped
-- and recreated, the seed only fires when the row is absent, and the publication
-- add swallows a duplicate.
-- ============================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- When true, the public leaderboard, the per-team point totals on /teams and
  -- the score breakdown on a team's page are replaced with a "hidden" message.
  leaderboard_hidden BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Which admin last flipped a switch. SET NULL so removing an account later
  -- doesn't take the settings row with it.
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- Row level security: public read, admin write
-- ----------------------------------------------------------------------------
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App settings readable" ON public.app_settings;
DROP POLICY IF EXISTS "Admins manage app settings" ON public.app_settings;

CREATE POLICY "App settings readable" ON public.app_settings
  FOR SELECT USING (true);

-- Admins only — not volunteers. Volunteers record results all day; deciding
-- when the room gets to see the standings is the organiser's call.
CREATE POLICY "Admins manage app settings" ON public.app_settings
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
-- The point of the switch is that the reveal lands on every phone in the room at
-- once, without anyone being told to refresh.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- Seed the single settings row (only when absent)
-- ----------------------------------------------------------------------------
INSERT INTO public.app_settings (id, leaderboard_hidden)
SELECT 1, false
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

COMMIT;
