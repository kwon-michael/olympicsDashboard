import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-4",
  lg: "w-12 h-12 border-4",
};

export function Spinner({
  size = "md",
  className,
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "border-coral border-t-transparent rounded-full animate-spin",
        sizeClasses[size],
        className
      )}
    />
  );
}

// Centered full-height loader for page/data loading states.
export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      {label && <p className="text-sm text-muted animate-pulse">{label}</p>}
    </div>
  );
}
