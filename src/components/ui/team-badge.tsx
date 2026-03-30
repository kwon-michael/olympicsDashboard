import { cn } from "@/lib/utils";

interface TeamBadgeProps {
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function TeamBadge({
  name,
  color,
  avatarUrl,
  size = "md",
  className,
}: TeamBadgeProps) {
  const sizeClasses = {
    sm: "h-6 text-xs gap-1.5 px-2",
    md: "h-8 text-sm gap-2 px-3",
    lg: "h-10 text-base gap-2.5 px-4",
  };

  const avatarSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-semibold text-white",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
    >
      <div
        className={cn(
          "rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold",
          avatarSizes[size]
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>
      <span className="truncate max-w-[120px]">{name}</span>
    </div>
  );
}
