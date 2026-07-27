-- ============================================
-- Add the event_rules overrides table
-- ============================================
-- Adds the DB-backed rulebook editor storage (see /admin/rules). Holds only the
-- editable text fields for each event, keyed by the slug from src/lib/events.ts.
-- NULL columns fall back to the code defaults, so creating this table empty
-- leaves the /rules pages unchanged. Any admin may edit; everyone can read.
--
-- Safe to run once against an existing database. Uses IF NOT EXISTS / DROP
-- POLICY IF EXISTS so a re-run won't error.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_rules (
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

DROP POLICY IF EXISTS "Event rules are viewable by everyone" ON public.event_rules;
CREATE POLICY "Event rules are viewable by everyone" ON public.event_rules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert event rules" ON public.event_rules;
CREATE POLICY "Admins can insert event rules" ON public.event_rules
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update event rules" ON public.event_rules;
CREATE POLICY "Admins can update event rules" ON public.event_rules
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete event rules" ON public.event_rules;
CREATE POLICY "Admins can delete event rules" ON public.event_rules
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Live updates on the /rules pages (ignore error if already in the publication).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rules;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
