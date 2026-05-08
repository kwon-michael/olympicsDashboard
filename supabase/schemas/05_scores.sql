-- ============================================
-- SCORES TABLE
-- ============================================
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  value INTEGER NOT NULL,
  notes TEXT,
  metadata JSONB,
  recorded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scores are viewable by everyone" ON public.scores
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert scores" ON public.scores
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update scores" ON public.scores
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete scores" ON public.scores
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- MATERIALIZED VIEW: LEADERBOARD
-- ============================================
CREATE MATERIALIZED VIEW public.mv_leaderboard AS
SELECT
  t.id AS team_id,
  t.name AS team_name,
  t.color AS team_color,
  t.avatar_url AS team_avatar_url,
  COALESCE(SUM(s.value), 0)::INTEGER AS total_points,
  COUNT(DISTINCT s.event_id)::INTEGER AS event_count,
  RANK() OVER (ORDER BY COALESCE(SUM(s.value), 0) DESC)::INTEGER AS rank
FROM public.teams t
LEFT JOIN public.scores s ON s.team_id = t.id
GROUP BY t.id, t.name, t.color, t.avatar_url
ORDER BY total_points DESC;

CREATE UNIQUE INDEX idx_mv_leaderboard_team ON public.mv_leaderboard(team_id);

-- ============================================
-- FUNCTION: Refresh leaderboard on score change
-- ============================================
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_leaderboard;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_leaderboard
AFTER INSERT OR UPDATE OR DELETE ON public.scores
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_leaderboard();
