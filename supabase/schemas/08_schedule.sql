-- ============================================
-- SCHEDULE ENTRIES TABLE
-- ============================================
CREATE TABLE public.schedule_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('ceremony', 'solo_event', 'team_event', 'break', 'general')),
  event_slug TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedule entries are viewable by everyone" ON public.schedule_entries
  FOR SELECT USING (true);

CREATE POLICY "Admins can create schedule entries" ON public.schedule_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update schedule entries" ON public.schedule_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete schedule entries" ON public.schedule_entries
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;
