-- ============================================
-- dodgeball_matches.survivors_a / survivors_b — players left alive per round
-- ============================================
-- Dodgeball awards a point per opponent eliminated, counted at the end of each
-- round. Rather than asking a referee to total eliminations in their head, the
-- recorder captures the number they can actually see on court when the round
-- ends — how many players are still alive — and the app derives the rest:
--
--   eliminations by A  =  Σ over rounds of (B's team size − B's survivors)
--
-- One array entry per round, so a best-of-3 holds up to three; NULL entries are
-- rounds not played or not yet counted, and contribute nothing. Storing the raw
-- observation rather than the computed total follows how solo_results and
-- roster_scores.metadata already work — the number a human recorded is kept, and
-- the points are derived from it (see src/lib/tournamentPoints.ts).
--
-- Note this counts by end-of-round headcount, which is what the rule says. A
-- player eliminated and then brought back by a team-mate's catch nets out, so it
-- is not a tally of every hit landed.
--
-- Tug of War has no equivalent, so tug_matches is deliberately left alone.

BEGIN;

ALTER TABLE public.dodgeball_matches
  ADD COLUMN IF NOT EXISTS survivors_a INT[];
ALTER TABLE public.dodgeball_matches
  ADD COLUMN IF NOT EXISTS survivors_b INT[];

-- Supersedes the plain elimination counters an earlier draft of this migration
-- added. They never held data — the feature that wrote them was never in
-- service — so they're dropped rather than converted.
ALTER TABLE public.dodgeball_matches DROP COLUMN IF EXISTS elims_a;
ALTER TABLE public.dodgeball_matches DROP COLUMN IF EXISTS elims_b;

COMMIT;
