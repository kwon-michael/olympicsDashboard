import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What the public sees in place of the standings while an admin has the
 * leaderboard hidden. Deliberately says *hidden*, not "no scores yet" — points
 * are still being recorded the whole time, and a message implying otherwise
 * sends people to the score desk asking why their event didn't count.
 */
export function LeaderboardHiddenNotice({
  title = "The leaderboard is hidden",
  hint = "Scores are still being recorded — the standings are under wraps until the organisers reveal them.",
  className,
}: {
  title?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border px-6 py-16 text-center",
        className
      )}
    >
      <EyeOff aria-hidden className="mx-auto mb-4 h-8 w-8 text-muted/60" />
      <p className="font-display text-base font-semibold text-foreground">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {hint}
      </p>
    </div>
  );
}

/**
 * The compact form, for pages where the standings are a detail rather than the
 * subject — the team list and a team's profile. Same message as the full notice
 * in a single line, so a page missing its point totals explains itself instead
 * of just looking broken.
 */
export function LeaderboardHiddenLine({
  children = "Point totals are hidden while the leaderboard is under wraps. Scores are still being recorded.",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed text-muted",
        className
      )}
    >
      <EyeOff aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * The counterpart for admins, who keep seeing the real board while it's hidden.
 * Without a marker on the page it's very easy to flip the switch, look at your
 * own screen, see the standings and assume it didn't take.
 */
export function LeaderboardHiddenBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3",
        className
      )}
    >
      <EyeOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
      <p className="text-xs leading-relaxed text-foreground">
        <span className="font-semibold">Hidden from everyone else.</span> Admins
        keep seeing the live board; the public sees a &ldquo;leaderboard
        hidden&rdquo; message instead. Points are still being recorded normally.
      </p>
    </div>
  );
}
