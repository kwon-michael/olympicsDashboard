-- ============================================
-- EVENT RULE OVERRIDES TABLE
-- ============================================
-- Per-event editable rulebook content, keyed by the event `slug` defined in
-- src/lib/events.ts. This table holds ONLY the human-readable text fields an
-- organizer might want to tweak; the code remains the source of truth for
-- structure (icon, color, type, scoring config). Any column left NULL means
-- "use the code default for that field" — the /rules pages merge base ← override
-- per field, so an empty table changes nothing.
--
-- Any admin may edit (INSERT/UPDATE/DELETE); everyone can read.
-- ============================================
CREATE TABLE public.event_rules (
  slug TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  description TEXT,
  participants TEXT,
  attempts TEXT,
  equipment TEXT[],
  rules TEXT[],
  scoring TEXT,
  setup TEXT[],
  tips TEXT[],
  conditions TEXT[],
  updated_by UUID NOT NULL REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event rules are viewable by everyone" ON public.event_rules
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert event rules" ON public.event_rules
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update event rules" ON public.event_rules
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete event rules" ON public.event_rules
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rules;
