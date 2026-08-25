-- ============================================
-- Event photos — the shared gallery
-- ============================================
-- Photos from the day, uploaded from the site and shown at /photos. A row here
-- is a *record* of a photo; the image bytes live in Supabase Storage, and the
-- row points at them.
--
-- Two renditions are stored per photo, both produced in the browser before
-- upload (see src/lib/photos.ts):
--
--   path        the display image, longest edge 1600px
--   thumb_path  the grid thumbnail, longest edge 480px
--
-- Downscaling on the client rather than on the way out is deliberate. A phone
-- photo is 4-6MB and 4000px wide; a gallery of thirty of those is a 150MB page
-- that costs a fortune in storage and takes a minute to load on venue wifi.
-- Supabase's own image transformations would solve it, but they're a paid
-- feature — and the browser already has a perfectly good canvas.
--
-- `width` and `height` are the display rendition's dimensions, kept so the grid
-- can reserve the right space before an image loads. Without them the whole page
-- reflows as photos arrive, which on a phone means the thing you were looking at
-- jumps out from under your thumb.
--
-- Who can do what:
--
--   read     everyone, signed in or not — the gallery is public like the rest
--            of the site
--   upload   anyone who can sign in (admin, volunteer, captain). Participants
--            don't get accounts, so in practice this is the people running it
--   delete   an admin, or whoever uploaded it
--
-- Safe to run more than once: the table and bucket use IF NOT EXISTS / ON
-- CONFLICT, policies are dropped and recreated, and the publication add
-- swallows a duplicate.
-- ============================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Storage keys within the bucket below, not URLs: the public URL is derived
  -- at render time, so moving the project or the bucket doesn't strand rows.
  path TEXT NOT NULL UNIQUE,
  thumb_path TEXT NOT NULL,
  -- Display rendition dimensions, for reserving grid space before load.
  width INT NOT NULL CHECK (width > 0),
  height INT NOT NULL CHECK (height > 0),
  caption TEXT,
  -- uploaded_by goes NULL if the account is removed; uploader_name snapshots the
  -- display name so the credit under a photo survives the account.
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  uploader_name TEXT,
  -- The photo's identity in a Google Photos album it was imported from (see
  -- scripts/import-google-photos.ts), and NULL for anything uploaded through the
  -- site. UNIQUE is what makes a re-import safe: running the script again after
  -- more photos are added to the album brings in only the new ones.
  source_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The gallery is always read newest-first.
CREATE INDEX IF NOT EXISTS idx_event_photos_created
  ON public.event_photos(created_at DESC);

-- ----------------------------------------------------------------------------
-- Storage bucket
-- ----------------------------------------------------------------------------
-- Public, so the gallery renders with plain URLs and no signed-URL round trip
-- per image. The limits are belt and braces: the browser downscales well under
-- them before uploading, but a client that skipped that step still can't push a
-- 50MB file or something that isn't an image.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-photos',
  'event-photos',
  true,
  8388608, -- 8MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Row level security — the table
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event photos readable" ON public.event_photos;
DROP POLICY IF EXISTS "Signed-in users add photos" ON public.event_photos;
DROP POLICY IF EXISTS "Owners and admins edit photos" ON public.event_photos;
DROP POLICY IF EXISTS "Owners and admins delete photos" ON public.event_photos;

CREATE POLICY "Event photos readable" ON public.event_photos
  FOR SELECT USING (true);

-- `uploaded_by = auth.uid()` in the check stops a signed-in user from filing a
-- photo under somebody else's name.
CREATE POLICY "Signed-in users add photos" ON public.event_photos
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'volunteer', 'captain')
    )
  );

CREATE POLICY "Owners and admins edit photos" ON public.event_photos
  FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Owners and admins delete photos" ON public.event_photos
  FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- Row level security — the bucket
-- ----------------------------------------------------------------------------
-- The table policies above govern the *rows*; these govern the *bytes*. Both are
-- needed: without these, a signed-in user could write files into the bucket
-- without ever creating a row, and deleting a photo would leave its image behind.
DROP POLICY IF EXISTS "Event photos publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Signed-in users upload event photos" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins delete event photo files" ON storage.objects;

CREATE POLICY "Event photos publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-photos');

CREATE POLICY "Signed-in users upload event photos" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'event-photos'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'volunteer', 'captain')
    )
  );

-- `owner` is set by Storage to the uploading user, so this mirrors the table's
-- delete rule: your own photo, or anything if you're an admin.
CREATE POLICY "Owners and admins delete event photo files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'event-photos'
    AND (
      owner = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
-- The point of a shared gallery during an event is that a photo taken on court
-- appears on everyone else's phone without them reloading anything.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_photos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
