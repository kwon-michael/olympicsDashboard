import { cn } from "@/lib/utils";

/**
 * A compact labelled form slot for dense grids (the score recorders), where
 * `Input`/`Select`'s own `label` prop would be too heavy. Always pass the same
 * `htmlFor` as the control's `id` so clicking the label focuses the control.
 */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted uppercase"
      >
        {label}
      </label>
      {children}
      {hint && <p className={cn("mt-1 text-[11px] text-muted")}>{hint}</p>}
    </div>
  );
}
