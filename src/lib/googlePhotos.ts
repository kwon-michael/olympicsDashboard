// ============================================
// Google Photos shared albums — reading one, carefully
// ============================================
// Google withdrew the Library API's read scopes on 31 March 2025: an app can now
// only see media it uploaded itself, and the Picker API that replaced them needs
// a human to choose files in a session. Neither can point a website at an album.
//
// What still works is the *public share page*. A shared album is a normal HTML
// page with its image URLs inlined, and those URLs serve any size you ask for by
// suffix (`=w1600`). This module reads that page.
//
// It is unsupported and Google can change it at any time — which is exactly why
// nothing here runs when someone loads the site. It runs once, from
// scripts/import-google-photos.ts, and copies the photos into our own storage
// (see src/lib/photos.ts). If Google changes the page tomorrow, the gallery
// doesn't notice; only the next import does.
//
// Everything in this file is pure: HTML in, facts out. That keeps the part most
// likely to break under test.

/** Photo URLs on a shared album page, in the order they appear, deduplicated. */
export function extractPhotoUrls(html: string): string[] {
  // Photos are served from the `/pw/` path. Avatars and UI chrome live under
  // other prefixes on the same host, so the prefix is the filter.
  const matches = html.match(
    /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_\-/]+/g
  );
  if (!matches) return [];

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const url of matches) {
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/**
 * A stable identifier for a photo, used to skip anything already imported so the
 * script can be re-run when new photos are added to the album.
 *
 * The token in the URL is the photo's own identity — the same photo keeps it
 * across page loads — so the last path segment is the id.
 */
export function sourceIdFor(url: string): string {
  const segments = url.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? url;
}

/**
 * Ask for a specific rendition. Google resizes server-side, so we never download
 * the original: the display copy and the thumbnail arrive already sized, which
 * is the one respect in which importing beats uploading from a phone.
 */
export function sizedUrl(baseUrl: string, maxEdge: number): string {
  return `${baseUrl}=w${maxEdge}`;
}

/**
 * Pixel dimensions of a JPEG, read from its header.
 *
 * Needed because the gallery stores each photo's size to reserve grid space
 * before the image loads, and a download gives us bytes rather than an
 * `<img>` that could report them. Walks the marker segments to the frame header
 * (any SOFn) and reads the two 16-bit values there; returns null if the buffer
 * isn't a JPEG or ends early.
 */
export function readJpegSize(
  bytes: Uint8Array
): { width: number; height: number } | null {
  // Start of Image.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  // Frame headers. The gaps are markers that share the 0xC0 block without
  // describing a frame: 0xC4 (Huffman tables), 0xC8, 0xCC (arithmetic coding).
  const FRAME_MARKERS = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);

  let i = 2;
  while (i < bytes.length - 1) {
    // Segments are 0xFF-led; padding bytes between them are also 0xFF.
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];

    // Standalone markers: no length field to skip.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // Start of Scan — image data from here on, and no frame header was found.
    if (marker === 0xda) return null;

    if (i + 3 >= bytes.length) return null;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];

    if (FRAME_MARKERS.has(marker)) {
      // Frame header: precision (1 byte), then height and width as 16-bit.
      if (i + 8 >= bytes.length) return null;
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      if (width === 0 || height === 0) return null;
      return { width, height };
    }

    // A length under 2 would leave the walk stuck on the same byte forever.
    if (length < 2) return null;
    i += 2 + length;
  }

  return null;
}
