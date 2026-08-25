// ============================================
// Event photos — storage, downscaling and access
// ============================================
// The gallery at /photos (see supabase/photos.sql for the table, the bucket and
// who is allowed to do what).
//
// The interesting part is what happens before an upload. A photo off a phone is
// 4-6MB and 4000px across; thirty of those in a grid is a page nobody on venue
// wifi will wait for. So the browser resizes each one twice — a display image
// and a thumbnail — and uploads those instead of the original. The full-fat
// original is never sent anywhere, which also means the gallery costs a fraction
// of the storage.
//
// Everything above `uploadPhoto` is pure and tested; everything below it needs a
// browser (canvas) or a network (Supabase) and isn't.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventPhoto } from "@/lib/types";

export const PHOTO_BUCKET = "event-photos";

/**
 * The largest file we'll *accept* — not the largest we'll store. It's generous
 * because it's measured before downscaling, and the point of the limit is to
 * reject a video or a RAW file someone picked by mistake, not to police the
 * megapixels of a phone camera.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * What a file picker is allowed to hand us. HEIC is on the list because that's
 * what iPhones shoot: iOS transcodes to JPEG on its way through the file input,
 * but a HEIC that arrives intact still has to get past this check before we find
 * out whether the browser can decode it (`decodeImage` reports it if not).
 */
export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/** Longest edge of the image the lightbox shows. */
export const DISPLAY_MAX_EDGE = 1600;

/** Longest edge of the image the grid shows. */
export const THUMB_MAX_EDGE = 480;

/** JPEG quality for both renditions — the knee of the size/artefact curve. */
const JPEG_QUALITY = 0.82;

/**
 * Scale `width` × `height` down to fit inside a square of `maxEdge`, preserving
 * the aspect ratio. An image already smaller than the box is left alone: blowing
 * a small photo up to 1600px would cost bytes and add nothing.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    // Never round a dimension down to zero — a 1px sliver is still an image,
    // a 0px canvas throws.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Why this file can't be uploaded, or null if it can. Returns the sentence shown
 * to the person who picked it, so it says what to do rather than what went
 * wrong.
 */
export function rejectionReason(file: {
  type: string;
  size: number;
  name?: string;
}): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "That's not an image file — pick a JPEG, PNG or WebP.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    return `That photo is ${mb}MB, which is bigger than the ${Math.round(
      MAX_UPLOAD_BYTES / (1024 * 1024)
    )}MB limit.`;
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

/**
 * Where a photo's two renditions live in the bucket. Derived from the row id, so
 * the pair is always findable from the row alone — including when the row is
 * being deleted and the files have to go with it.
 */
export function photoPaths(id: string): { display: string; thumb: string } {
  return { display: `${id}/display.jpg`, thumb: `${id}/thumb.jpg` };
}

// ----------------------------------------------------------------------------
// Reading
// ----------------------------------------------------------------------------

/** The public URL for a stored object. The bucket is public — no signing. */
export function photoUrl(supabase: SupabaseClient, path: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Every photo, newest first. */
export async function fetchPhotos(
  supabase: SupabaseClient
): Promise<EventPhoto[]> {
  const { data } = await supabase
    .from("event_photos")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as EventPhoto[]) ?? [];
}

// ----------------------------------------------------------------------------
// Writing (browser only)
// ----------------------------------------------------------------------------

/**
 * Decode a file into something drawable, honouring its EXIF orientation.
 *
 * `imageOrientation: "from-image"` is the whole reason this goes through
 * `createImageBitmap` rather than an `<img>`: a photo taken in portrait carries
 * its rotation in EXIF rather than in the pixels, and a canvas that ignores that
 * writes every phone photo out sideways.
 */
async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "This browser couldn't read that image. If it came off an iPhone, try sharing it as a JPEG."
    );
  }
}

/** Draw a bitmap into a JPEG of at most `maxEdge`, and hand back the bytes. */
async function renderTo(
  bitmap: ImageBitmap,
  maxEdge: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't prepare the image for upload.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("Couldn't prepare the image for upload.");
  return { blob, width, height };
}

/**
 * Resize, upload and record one photo.
 *
 * Ordered so a failure can't leave the gallery describing something that isn't
 * there: both images go up first, and the row — the only thing the gallery
 * reads — is written last. A crash midway leaves at worst a couple of orphaned
 * files in the bucket, which nothing renders and which cost pennies; the reverse
 * order would leave a row pointing at a missing image, which is a broken tile on
 * everyone's screen.
 */
export async function uploadPhoto(
  supabase: SupabaseClient,
  file: File,
  caption: string
): Promise<void> {
  const reason = rejectionReason(file);
  if (reason) throw new Error(reason);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You need to be signed in to add a photo.");

  const bitmap = await decodeImage(file);
  let display: Awaited<ReturnType<typeof renderTo>>;
  let thumb: Awaited<ReturnType<typeof renderTo>>;
  try {
    display = await renderTo(bitmap, DISPLAY_MAX_EDGE);
    thumb = await renderTo(bitmap, THUMB_MAX_EDGE);
  } finally {
    // Bitmaps hold their decoded pixels off-heap; on a phone, uploading a dozen
    // photos without releasing them is how the tab gets killed.
    bitmap.close();
  }

  const id = crypto.randomUUID();
  const paths = photoPaths(id);

  for (const [path, blob] of [
    [paths.display, display.blob],
    [paths.thumb, thumb.blob],
  ] as const) {
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(`Couldn't upload that photo — ${error.message}`);
  }

  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("event_photos").insert({
    id,
    path: paths.display,
    thumb_path: paths.thumb,
    width: display.width,
    height: display.height,
    caption: caption.trim() || null,
    uploaded_by: user.id,
    uploader_name: (profile?.display_name as string | undefined) ?? null,
  });
  if (error) throw new Error(`Couldn't save that photo — ${error.message}`);
}

/**
 * Remove a photo and both of its files.
 *
 * The row goes first here, for the same reason it went last on the way in: the
 * gallery reads rows, so dropping the row is what actually removes the photo
 * from every screen. If the file delete then fails, the bytes linger
 * unreferenced — untidy, but invisible and harmless.
 */
export async function deletePhoto(
  supabase: SupabaseClient,
  photo: EventPhoto
): Promise<void> {
  const { error } = await supabase
    .from("event_photos")
    .delete()
    .eq("id", photo.id);
  if (error) throw new Error(`Couldn't delete that photo — ${error.message}`);

  await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([photo.path, photo.thumb_path]);
}
