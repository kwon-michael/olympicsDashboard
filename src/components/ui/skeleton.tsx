import { cn } from "@/lib/utils";

/** A single pulsing placeholder block. Compose these to mirror real content. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-foreground/10", className)}
    />
  );
}

/**
 * A stack of card-shaped placeholder rows — the default loading state for the
 * list/table style pages (leaderboard, teams, roster, scores, recorders …).
 */
export function SkeletonList({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("w-full space-y-3", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
        >
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Full-page skeleton for route-level loading (title + subtitle + list). */
export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6"
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <SkeletonList rows={6} />
    </div>
  );
}
