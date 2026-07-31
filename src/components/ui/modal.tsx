"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  /** Called for every dismissal route: Esc, backdrop click, the close button. */
  onClose: () => void;
  title: string;
  /** Small label above the title — usually where the modal was opened from. */
  eyebrow?: string;
  /** Icon rendered in the header tile; pair it with `accentClassName`. */
  icon?: ReactNode;
  /** Tailwind classes for the header icon tile, e.g. "bg-indigo-500/10 text-indigo-500". */
  accentClassName?: string;
  /** Action row pinned below the scrollable body. */
  footer?: ReactNode;
  /** Set while an action is in flight: dismissal routes are turned off. */
  busy?: boolean;
  /** Overrides the default width. */
  className?: string;
  children: ReactNode;
}

/**
 * A modal window built on the native `<dialog>` element.
 *
 * `showModal()` gives us the top layer (so no z-index ladder), the focus trap,
 * inertness of the page behind, and Esc handling for free — the component only
 * has to route those back into React state. Enter/exit animation is pure CSS in
 * globals.css (`.app-modal`), which is why the element stays mounted while
 * closed: an unmounted dialog can't animate out.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  icon,
  accentClassName,
  footer,
  busy = false,
  className,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Tracks where a click started, so dragging a selection from inside the panel
  // out onto the backdrop doesn't read as a backdrop click.
  const pressedBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  /** True when the point is outside the panel box — i.e. on the backdrop. */
  function isOnBackdrop(e: { clientX: number; clientY: number }) {
    const el = dialogRef.current;
    if (!el) return false;
    // The backdrop is the dialog's own pseudo-element, so pointer events on it
    // still target the dialog. Geometry is what separates the two.
    const r = el.getBoundingClientRect();
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={cn(
        "app-modal m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[min(88svh,46rem)] rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl",
        className
      )}
      onPointerDown={(e) => {
        pressedBackdrop.current = isOnBackdrop(e);
      }}
      onClick={(e) => {
        if (!busy && pressedBackdrop.current && isOnBackdrop(e)) onClose();
        pressedBackdrop.current = false;
      }}
      onCancel={(e) => {
        // Esc. Blocked mid-action so a keystroke can't hide work in flight.
        if (busy) e.preventDefault();
      }}
      onClose={() => {
        if (open) onClose();
      }}
    >
      <div className="flex max-h-[inherit] flex-col">
        <header className="flex items-start gap-3 border-b border-border px-6 py-5">
          {icon && (
            <span
              aria-hidden
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                accentClassName ?? "bg-coral/10 text-coral"
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {eyebrow}
              </p>
            )}
            <h2
              id={titleId}
              className="font-display text-lg font-bold leading-tight text-foreground"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-1.5 -mt-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-navy/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
