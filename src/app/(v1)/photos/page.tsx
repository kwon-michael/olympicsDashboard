"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  Loader2,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import {
  ACCEPTED_TYPES,
  deletePhoto,
  fetchPhotos,
  photoUrl,
  uploadPhoto,
} from "@/lib/photos";
import type { EventPhoto } from "@/lib/types";

// ============================================
// The shared gallery
// ============================================
// Photos from the day, in one place, updating live: the realtime provider
// dispatches `photos-updated` when a row lands, so a photo taken on court
// appears on every open phone without anyone reloading. See supabase/photos.sql
// for who can upload and src/lib/photos.ts for what happens to a file on its way
// in (it gets resized twice in the browser — a phone photo is 4-6MB and this
// grid would be unusable otherwise).
//
// Anyone can look. Uploading needs an account, which in practice means the
// people running the event, since participants don't get one.
//
// A tile whose image doesn't arrive asks again before giving up, and drops out
// of the grid if it still can't get one — see `Tile` for why that's a retry
// rather than a straight removal.

/**
 * How many times a tile re-requests an image before it gives up on it.
 *
 * Every photo in the gallery is a file that exists — the failures are the
 * request, not the photograph: a dropped connection on venue wifi, or storage
 * shedding load when three hundred thumbnails are asked for at once. That kind
 * of failure is over by the time you've noticed it, and an image element has no
 * opinion on the matter: it fires `error` once and stays broken for the rest of
 * the page's life. Two more goes is enough for anything transient.
 */
const IMAGE_RETRIES = 2;

/** How long to wait before each of those goes. */
const RETRY_MS = [700, 2100];

export default function PhotosPage() {
  const user = useAppStore((s) => s.user);
  const [photos, setPhotos] = useState<EventPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<EventPhoto | null>(null);
  // Photos whose image couldn't be fetched, after retries. Kept by id rather
  // than by filtering `photos`, so a reload — or a realtime insert — doesn't
  // have to know anything about them.
  const [lost, setLost] = useState<ReadonlySet<string>>(() => new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  // Memoised rather than made per call: `photoUrl` needs it during render, to
  // turn each row's storage key into a src.
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    setPhotos(await fetchPhotos(supabase));
  }, [supabase]);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("photos-updated", onChange);
    return () => window.removeEventListener("photos-updated", onChange);
  }, [load]);

  const onLost = useCallback((id: string) => {
    setLost((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  // What the grid actually draws. A tile that can't produce a picture is worse
  // than no tile: it holds a photo-shaped hole in the middle of the gallery.
  const visible = useMemo(
    () => (photos ?? []).filter((photo) => !lost.has(photo.id)),
    [photos, lost]
  );

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    // Reset immediately so picking the same file twice in a row still fires.
    e.target.value = "";
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    // One at a time rather than all at once: a phone uploading six photos in
    // parallel over venue wifi tends to time all six out.
    for (const file of files) {
      try {
        await uploadPhoto(supabase, file, "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "That upload failed.");
        break;
      }
    }
    await load();
    setBusy(false);
  }

  async function onDelete(photo: EventPhoto) {
    if (!confirm("Delete this photo? It won't be recoverable.")) return;
    setBusy(true);
    try {
      await deletePhoto(supabase, photo);
      setLightbox(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That delete failed.");
    }
    await load();
    setBusy(false);
  }

  // Admins can remove anything; everyone else only what they put up. This
  // mirrors the RLS policy rather than enforcing anything — the database is
  // what actually decides — so the button doesn't appear where it would fail.
  const canDelete = (photo: EventPhoto) =>
    !!user && (user.role === "admin" || photo.uploaded_by === user.id);

  return (
    <PageTransition>
      {/* Hero */}
      <div className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
            <Camera className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium text-white/80">
              August 8, 2026
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">PHOTOS</h1>
          <p className="mx-auto mt-3 max-w-xl text-white/60">
            The day as it happened. New ones appear here as they&apos;re added —
            no need to refresh.
          </p>

          {user && (
            <div className="mt-6">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                multiple
                className="hidden"
                onChange={onPick}
              />
              <Button
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                className="bg-coral hover:bg-coral-light text-white"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {busy ? "Uploading…" : "Add photos"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/[0.07] p-4"
          >
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <p className="flex-1 text-sm text-foreground">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-xs font-semibold text-muted transition-colors hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {photos === null ? (
          <SkeletonList rows={6} />
        ) : visible.length === 0 ? (
          // Told apart on purpose: a gallery nobody has added to yet and a
          // gallery whose every image failed to arrive are not the same
          // situation, and "no photos yet" is a lie about the second one.
          photos.length === 0 ? (
            <EmptyState signedIn={!!user} />
          ) : (
            <UnreachableState />
          )
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {visible.map((photo) => (
              <Tile
                key={photo.id}
                photo={photo}
                src={photoUrl(supabase, photo.thumb_path)}
                onOpen={() => setLightbox(photo)}
                onLost={onLost}
              />
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          photo={lightbox}
          src={photoUrl(supabase, lightbox.path)}
          onClose={() => setLightbox(null)}
          onDelete={canDelete(lightbox) ? () => onDelete(lightbox) : undefined}
          busy={busy}
        />
      )}
    </PageTransition>
  );
}

/**
 * One photo in the grid.
 *
 * The wrapper carries the stored aspect ratio, so a tile occupies its final
 * shape from the first paint. Without it the column heights rewrite themselves
 * as each image arrives, and on a phone that means whatever you were about to
 * tap moves out from under your thumb.
 *
 * If the image doesn't arrive, the tile asks again — twice, backing off — and
 * only then reports itself lost and leaves the grid. The order matters: the
 * files behind these rows are all present, so a tile that has failed has almost
 * certainly hit a dropped request rather than a missing photograph, and
 * removing it on the first `error` would quietly delete a good photo from the
 * gallery for the rest of the visit. Retrying costs one request; getting it
 * wrong costs somebody their picture of the day.
 */
function Tile({
  photo,
  src,
  onOpen,
  onLost,
}: {
  photo: EventPhoto;
  src: string;
  onOpen: () => void;
  onLost: (id: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const retry = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(retry.current), []);

  // A browser caches a failed request as a failure, so asking the same question
  // gets the same answer without leaving the machine. The attempt number in the
  // query string makes it a different question; Supabase ignores it.
  const attemptSrc = attempt === 0 ? src : `${src}?retry=${attempt}`;

  function onError() {
    if (attempt >= IMAGE_RETRIES) {
      onLost(photo.id);
      return;
    }
    const wait = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)];
    retry.current = window.setTimeout(() => setAttempt((n) => n + 1), wait);
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border border-border bg-card"
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      {/* Plain <img>, not next/image: these are already resized for the web on
          the way in, and the optimiser would only add a remote-pattern config
          tied to whichever Supabase project the deploy points at. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attemptSrc}
        alt={photo.caption ?? "Casualympics photo"}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        onError={onError}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </button>
  );
}

/**
 * Every photo in the gallery failed to load. Almost always the connection
 * rather than the gallery, so it says so and offers the one thing that helps.
 */
function UnreachableState() {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center">
      <TriangleAlert className="mx-auto mb-4 h-10 w-10 text-muted" />
      <p className="font-display text-lg font-bold text-foreground">
        COULDN&apos;T LOAD THE PHOTOS
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        They&apos;re still there — the pictures just aren&apos;t reaching this
        device. Worth another go in a moment.
      </p>
    </div>
  );
}

function EmptyState({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center">
      <Camera className="mx-auto mb-4 h-10 w-10 text-muted" />
      <p className="font-display text-lg font-bold text-foreground">
        NO PHOTOS YET
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        {signedIn
          ? "Add the first one — it'll show up on everyone else's screen straight away."
          : "Photos from the day will appear here as they're added."}
      </p>
    </div>
  );
}

/**
 * The full-size view. Deliberately not the `Modal` component: that one is built
 * for forms — a header, an eyebrow, a footer action row — and all of that would
 * be furniture around a photograph. This is the picture, on black, and a way out.
 */
function Lightbox({
  photo,
  src,
  onClose,
  onDelete,
  busy,
}: {
  photo: EventPhoto;
  src: string;
  onClose: () => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Stop the gallery behind from scrolling under the photo.
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = previous;
    };
  }, [onClose]);

  const credit = photo.uploader_name;
  const taken = new Date(photo.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.caption ?? "Photo"}
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
    >
      <div className="flex items-center justify-end gap-2 p-4">
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={busy}
            aria-label="Delete this photo"
            className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-danger disabled:opacity-50"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={photo.caption ?? "Casualympics photo"}
          width={photo.width}
          height={photo.height}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="p-4 text-center text-xs text-white/50">
        {photo.caption && (
          <p className="mb-1 text-sm text-white/80">{photo.caption}</p>
        )}
        <p>
          {credit ? `${credit} · ` : ""}
          {taken}
        </p>
      </div>
    </div>
  );
}
