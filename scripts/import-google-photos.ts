/**
 * Import a public Google Photos shared album into the gallery.
 *
 * Usage:
 *   1. Run supabase/photos.sql first — this needs the table and the bucket.
 *   2. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   3. npx tsx scripts/import-google-photos.ts <share-url> [options]
 *
 * Options:
 *   --dry-run        List what would be imported. Touches nothing, and doesn't
 *                    need Supabase configured — use it first.
 *   --limit N        Import at most N photos. Worth doing a small run first.
 *   --credit "Name"  Shown under each imported photo. Default: no credit.
 *
 * Why a script and not a feature: reading a shared album means parsing a page
 * Google never promised to keep stable (the supported API can't do this any
 * more — see src/lib/googlePhotos.ts). Running it here, once, means the site
 * itself never depends on that. The photos land in our own storage and the
 * gallery neither knows nor cares where they came from.
 *
 * Safe to re-run. Photos are keyed by their Google id, so a second run after
 * more photos are added to the album imports only the new ones.
 *
 * WARNING: uses the service role key, which bypasses RLS. It never leaves this
 * machine — the browser never sees it.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  extractPhotoUrls,
  readJpegSize,
  sizedUrl,
  sourceIdFor,
} from "../src/lib/googlePhotos";

/** Matches the two renditions the gallery stores. See src/lib/photos.ts. */
const DISPLAY_MAX_EDGE = 1600;
const THUMB_MAX_EDGE = 480;
const BUCKET = "event-photos";

/** A browser UA — the share page serves a different shell to unknown clients. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Breather between photos, so a 300-photo album isn't a burst of traffic. */
const PAUSE_MS = 150;

// ----------------------------------------------------------------------------
// Arguments and environment
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const shareUrl = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const limit =
  limitArg >= 0 ? Number.parseInt(args[limitArg + 1] ?? "", 10) : Infinity;
const creditArg = args.indexOf("--credit");
const credit = creditArg >= 0 ? (args[creditArg + 1] ?? null) : null;

if (!shareUrl) {
  console.error(
    "Usage: npx tsx scripts/import-google-photos.ts <share-url> [--dry-run] [--limit N] [--credit \"Name\"]"
  );
  process.exit(1);
}

/**
 * Read .env.local ourselves. Node only loads env files when asked, and asking
 * differs by version — this keeps the command in the header working as written.
 */
function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

// ----------------------------------------------------------------------------
// Import
// ----------------------------------------------------------------------------
async function main() {
  console.log(`\n📷 Reading album: ${shareUrl}`);

  const response = await fetch(shareUrl!, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    console.error(
      `Couldn't open that album (HTTP ${response.status}). Check the link is a public share link.`
    );
    process.exit(1);
  }

  const urls = extractPhotoUrls(await response.text());
  if (urls.length === 0) {
    console.error(
      "No photos found on that page.\n" +
        "Either the album isn't shared publicly, or Google has changed the page\n" +
        "format — see extractPhotoUrls in src/lib/googlePhotos.ts."
    );
    process.exit(1);
  }
  console.log(`   Found ${urls.length} photos.`);

  if (dryRun) {
    console.log("\n--dry-run: nothing will be written.\n");
    for (const url of urls.slice(0, Math.min(limit, 10))) {
      console.log(`   ${sourceIdFor(url).slice(0, 24)}…  ${sizedUrl(url, DISPLAY_MAX_EDGE)}`);
    }
    if (urls.length > 10) console.log(`   … and ${urls.length - 10} more`);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)."
    );
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // What's already here, so a re-run only brings in what's new.
  const { data: existing, error: existingError } = await supabase
    .from("event_photos")
    .select("source_id")
    .not("source_id", "is", null);
  if (existingError) {
    console.error(
      `Couldn't read the gallery — ${existingError.message}\n` +
        "Has supabase/photos.sql been run?"
    );
    process.exit(1);
  }
  const alreadyHave = new Set(
    (existing ?? []).map((row) => row.source_id as string)
  );

  const pending = urls
    .filter((url) => !alreadyHave.has(sourceIdFor(url)))
    .slice(0, limit);

  console.log(
    `   ${alreadyHave.size} already imported, ${pending.length} to fetch.\n`
  );
  if (pending.length === 0) return;

  // The gallery orders newest first, and an import has no capture times to go
  // on — the share page doesn't carry them. Spacing the rows a second apart in
  // album order makes the gallery read in album order, and keeps it stable
  // across re-runs instead of leaving 300 rows sharing one timestamp.
  const base = Date.now();

  let imported = 0;
  let failed = 0;

  for (const [index, url] of pending.entries()) {
    const sourceId = sourceIdFor(url);
    const label = `[${index + 1}/${pending.length}]`;

    try {
      const [display, thumb] = await Promise.all([
        download(sizedUrl(url, DISPLAY_MAX_EDGE)),
        download(sizedUrl(url, THUMB_MAX_EDGE)),
      ]);

      const size = readJpegSize(new Uint8Array(display));
      if (!size) throw new Error("couldn't read the image dimensions");

      const id = crypto.randomUUID();
      const paths = { display: `${id}/display.jpg`, thumb: `${id}/thumb.jpg` };

      // Files first, then the row — the row is what the gallery reads, so this
      // way a failure leaves an orphaned file rather than a broken tile.
      for (const [path, bytes] of [
        [paths.display, display],
        [paths.thumb, thumb],
      ] as const) {
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error(error.message);
      }

      const { error } = await supabase.from("event_photos").insert({
        id,
        path: paths.display,
        thumb_path: paths.thumb,
        width: size.width,
        height: size.height,
        caption: null,
        uploaded_by: null,
        uploader_name: credit,
        source_id: sourceId,
        created_at: new Date(base - index * 1000).toISOString(),
      });
      if (error) throw new Error(error.message);

      imported++;
      console.log(`   ${label} ✓ ${size.width}×${size.height}`);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      // Carry on: one unreadable photo shouldn't cost the other 300.
      console.warn(`   ${label} ✗ ${sourceId.slice(0, 16)}… — ${message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }

  console.log(
    `\n✅ Imported ${imported} photo${imported === 1 ? "" : "s"}` +
      (failed > 0 ? `, ${failed} failed.` : ".") +
      "\n   They're live at /photos.\n"
  );
}

async function download(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`download failed (HTTP ${response.status})`);
  return response.arrayBuffer();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
