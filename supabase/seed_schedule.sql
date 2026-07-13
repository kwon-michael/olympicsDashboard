-- ============================================
-- Schedule: add section/lead columns + seed event-day timeline
-- Run once. Requires at least one admin account to exist
-- (used as created_by).
-- ============================================

ALTER TABLE public.schedule_entries ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.schedule_entries ADD COLUMN IF NOT EXISTS section_note TEXT;
ALTER TABLE public.schedule_entries ADD COLUMN IF NOT EXISTS lead TEXT;

-- Replace any existing entries with the canonical schedule.
DELETE FROM public.schedule_entries;

INSERT INTO public.schedule_entries
  (title, description, start_time, end_time, location, category, section, section_note, lead, sort_order, created_by)
SELECT
  v.title, v.description, v.start_time::time, v.end_time::time, v.location,
  v.category, v.section, v.section_note, v.lead, v.sort_order::int, u.id
FROM (VALUES
  -- Pre-Event: Registration & Team Formation
  ('Registration & Check-in',
   'Participants check in, hand in waivers, and receive their team number/color. Attendance is marked.',
   '09:15', '09:45', 'Registration Desk', 'general',
   'Pre-Event: Registration & Team Formation', NULL::text, '2 Registration Desk volunteers', 555),
  ('Welcome + Team Meet-up',
   'Teams are pre-assigned. Players find their teammates, participate in a quick icebreaker, and go over the rules overview.',
   '09:45', '10:00', 'Main Area', 'ceremony',
   'Pre-Event: Registration & Team Formation', NULL, 'MC / Host', 585),

  -- Solo Events
  ('Group A - Standing Long Jump & 100m',
   'Both events run at the same time. Volunteers measure, time, and record results.',
   '10:00', '10:40', 'Field A / Track', 'solo_event',
   'Solo Events', '3 groups rotating every 40 minutes. Two events run synchronously per group with 9 participants each.', '2 officials per event', 600),
  ('Group B - Triple Jump & 200m',
   'Athletes rotate through. Results are recorded on the Solo Events sheet.',
   '10:40', '11:20', 'Field A / Track', 'solo_event',
   'Solo Events', NULL, '2 officials per event', 640),
  ('Group C - Shot Put & Garbage Basketball',
   'Shot put requires a clear safety zone. Garbage Basketball uses a timed/most-makes scoring system.',
   '11:20', '12:00', 'Field B / Court', 'solo_event',
   'Solo Events', NULL, '2 officials per event', 680),

  -- Lunch Break
  ('Lunch Break',
   'Time for food and rest. Solo-event results will be posted if there is an overall standings board.',
   '12:00', '12:45', 'Main Area', 'break',
   'Lunch Break', NULL, '1-2 floaters', 720),
  ('Team Huddle (Strategy)',
   'Optional time for teams to regroup and strategize before the afternoon team block.',
   '12:45', '13:00', 'Main Area', 'general',
   'Lunch Break', NULL, 'MC / Host', 765),

  -- Team Events
  ('Tug of War Tournament',
   '3 pools of 3 -> pool round-robin -> top-4 playoff. Two ropes run in parallel, playing full best-of-3 matches.',
   '13:00', '14:00', 'Tug Area (2 ropes)', 'team_event',
   'Team Events', NULL, '2 Refs (1 per rope) + Safety + Scorekeeper', 780),
  ('Dodgeball Tournament',
   'Same format as Tug of War. Two courts run in parallel, and games run full-length (~6 min cap).',
   '14:00', '15:00', '2 Courts', 'team_event',
   'Team Events', NULL, '2 Refs (1 per court) + Scorekeeper', 840),
  ('Tail-Grab Deathmatch',
   'All teams participate at once in a battle-royale format. The last team with a tail standing wins. Plays for 2-3 rounds.',
   '15:00', '15:30', 'Open Field', 'team_event',
   'Team Events', NULL, '4 Refs', 900),
  ('Conditioned 75m Relay',
   'Heats of 3 teams (3 heats total), with the fastest advancing to a final. Each leg has specific ''conditions'' (e.g., sack race, 3-legged).',
   '15:30', '16:00', 'Track', 'team_event',
   'Team Events', NULL, 'Starter + 2 Finish/Timers', 930),

  -- Wrap-Up
  ('Wrap-Up & Awards',
   'Final standings, awards, and closing remarks.',
   '16:00', '16:30', 'Main Area', 'ceremony',
   'Wrap-Up', NULL, 'MC / Host', 960)
) AS v(title, description, start_time, end_time, location, category, section, section_note, lead, sort_order)
CROSS JOIN (
  SELECT id FROM public.users WHERE role = 'admin' ORDER BY created_at LIMIT 1
) AS u;
