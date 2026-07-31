import { cn } from "@/lib/utils";

/**
 * Medal tones for the top three places. These replace the 🥇🥈🥉 emoji: a
 * numeral in a metal-tinted disc reads at any size, matches the app's mono
 * numerals, and doesn't shift baseline the way emoji do across platforms.
 */
const MEDAL_TONES: Record<number, { edge: string; text: string; fill: string }> =
  {
    1: { edge: "#E0A227", text: "#7A4E05", fill: "rgba(245, 166, 35, 0.16)" },
    2: { edge: "#A8B0B8", text: "#55606D", fill: "rgba(168, 176, 184, 0.20)" },
    3: { edge: "#C07B34", text: "#7E4B1B", fill: "rgba(205, 127, 50, 0.15)" },
  };

/** Text colour for a rank shown as bare type (tables). Null past 3rd. */
export function medalTextColor(rank: number): string | null {
  return MEDAL_TONES[rank]?.text ?? null;
}

/**
 * A rank indicator. Places 1–3 get a metal-tinted disc; everything else is a
 * plain muted numeral, so the eye lands on the podium without any row needing
 * decoration.
 */
export function RankBadge({
  rank,
  className,
}: {
  rank: number;
  className?: string;
}) {
  const tone = MEDAL_TONES[rank];

  if (!tone) {
    return (
      <span
        className={cn(
          "font-mono text-[15px] font-medium tabular-nums text-muted/80",
          className
        )}
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-[13px] font-semibold tabular-nums",
        className
      )}
      style={{
        backgroundColor: tone.fill,
        color: tone.text,
        boxShadow: `inset 0 0 0 1px ${tone.edge}`,
      }}
    >
      {rank}
    </span>
  );
}
