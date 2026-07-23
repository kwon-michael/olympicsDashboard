-- ============================================
-- roster_scores.metadata — raw inputs for the team-event recorder
-- ============================================
-- The team-event results recorder (/admin/team-events) writes normal
-- roster_scores rows (so they flow into the leaderboard like any other points),
-- but also needs to remember the raw inputs behind each computed total — the
-- per-round placements and tail counts for Tail Grab, or the final time for the
-- Conditional Relay — so the form can be reopened and edited. Those raw inputs
-- live in this JSONB column. Plain manual scores leave it NULL.
ALTER TABLE public.roster_scores ADD COLUMN IF NOT EXISTS metadata JSONB;
