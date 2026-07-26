-- ============================================
-- Migrate teams from numbers to colors
-- ============================================
-- Renames the existing nine teams from "Team 1".."Team 9" to color identities
-- and repaints each team's color hex to match. Colors are assigned to teams in
-- a random order (ORDER BY random()), so each run shuffles which player group
-- gets which color. Player rows are untouched — teams keep their id, so every
-- player stays on their team.
--
-- Safe to re-run: it just reshuffles the color assignment across whatever teams
-- currently exist. Run once (re-running will scramble the colors again).
-- ============================================

BEGIN;

WITH colors(name, color) AS (
  VALUES
    ('Red',        '#EF4444'),
    ('Green',      '#22C55E'),
    ('Dark Blue',  '#1E40AF'),
    ('Light Blue', '#38BDF8'),
    ('Yellow',     '#FACC15'),
    ('Purple',     '#A855F7'),
    ('Orange',     '#F97316'),
    ('Pink',       '#EC4899'),
    ('Grey',       '#6B7280')
),
ranked_colors AS (
  SELECT name, color, row_number() OVER (ORDER BY random()) AS rn
  FROM colors
),
ranked_teams AS (
  SELECT id, row_number() OVER (ORDER BY sort_order, created_at) AS rn
  FROM public.roster_teams
)
UPDATE public.roster_teams t
SET name = c.name, color = c.color
FROM ranked_teams rt
JOIN ranked_colors c ON c.rn = rt.rn
WHERE t.id = rt.id;

COMMIT;
