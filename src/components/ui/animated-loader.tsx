import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * On-theme animated loading panel: a flowing navy→coral→gold aurora with a
 * light sweep, a pulsing flame badge, and bouncing dots. Fills its container
 * (`fullScreen` fills the viewport), so it's responsive across all screens.
 */
export function AnimatedLoader({
  label = "Loading",
  fullScreen = false,
  className,
}: {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "relative isolate flex items-center justify-center overflow-hidden",
        fullScreen ? "min-h-[100svh]" : "min-h-[220px] w-full rounded-xl",
        className
      )}
    >
      {/* Flowing brand-colored aurora */}
      <div className="loader-aurora absolute inset-0" />
      {/* Subtle darkening for text contrast over the gold band */}
      <div className="absolute inset-0 bg-navy-dark/25" />
      {/* Light sweep passing across */}
      <div className="loader-sweep absolute inset-0" />

      {/* Foreground */}
      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <span className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inline-flex h-full w-full rounded-full bg-white/40 animate-ping" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-coral shadow-lg">
            <Flame className="h-7 w-7 text-white" />
          </span>
        </span>

        <div className="flex items-end gap-1.5">
          <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">
            {label}
          </span>
          <span className="flex gap-1 pb-1">
            <span className="loader-dot h-1.5 w-1.5 rounded-full bg-white" />
            <span
              className="loader-dot h-1.5 w-1.5 rounded-full bg-white"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="loader-dot h-1.5 w-1.5 rounded-full bg-white"
              style={{ animationDelay: "0.3s" }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
