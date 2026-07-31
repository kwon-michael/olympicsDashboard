import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  /** Convenience list. Omit and pass `children` for grouped or custom options. */
  options?: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-semibold text-foreground">
            {label}
          </label>
        )}
        {/* `appearance-none` drops the platform arrow, so draw one back in —
            without it the control gives no sign it's a dropdown. */}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              "w-full appearance-none rounded-xl border border-border bg-card py-2.5 pr-9 pl-3.5 text-sm text-foreground transition-colors",
              "focus:border-coral focus:ring-2 focus:ring-coral/30 focus:outline-none",
              "disabled:opacity-50",
              error && "border-danger focus:border-danger focus:ring-danger/30",
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
