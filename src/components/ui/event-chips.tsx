import { cn } from "@/lib/utils";

/**
 * The horizontally scrolling event picker shared by the leaderboard's Events
 * tab and the solo recorder. Text plus a colour dot — the event's colour is the
 * only mark it needs, and it stays visible on the inactive chips too.
 */
export function EventChips<
  T extends { slug: string; name: string; color: string },
>({
  events,
  value,
  onChange,
  label,
  className,
}: {
  events: readonly T[];
  value: string;
  onChange: (slug: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1",
        className
      )}
    >
      {events.map((ev) => {
        const active = ev.slug === value;
        return (
          <button
            key={ev.slug}
            type="button"
            onClick={() => onChange(ev.slug)}
            aria-pressed={active}
            className={cn(
              "inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral",
              active
                ? "text-foreground"
                : "border-border bg-card text-muted hover:text-foreground"
            )}
            style={
              active
                ? { backgroundColor: `${ev.color}14`, borderColor: ev.color }
                : undefined
            }
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ev.color }}
            />
            {ev.name}
          </button>
        );
      })}
    </div>
  );
}
