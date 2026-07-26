/**
 * Casualympics brand mark — a running figure. Uses `currentColor` so callers
 * can size and color it with width, height and text utility classes just like a
 * lucide icon (it replaced the old Flame logo in the navbar, footer and auth
 * screens).
 */
export function RunnerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="14.5" cy="4.2" r="2.4" />
      <path d="M13.6 6.9c-.55-.12-1.12.08-1.47.52L8.3 12.1c-.3.38-.38.9-.2 1.35l1.3 3.2-2.86 3.3a1.3 1.3 0 0 0 1.96 1.7l3.4-3.92c.32-.37.42-.88.26-1.34l-.86-2.35 2.1-2.16.86 2.5c.14.4.46.72.87.85l3.3 1.07a1.3 1.3 0 1 0 .8-2.48l-2.62-.85-1.5-4.36c-.2-.6-.72-1.02-1.34-1.13z" />
      <path d="M8.4 8.1 4.3 9.05a1.2 1.2 0 0 0 .54 2.34l3.1-.72a1.2 1.2 0 0 0-.54-2.34z" />
    </svg>
  );
}
