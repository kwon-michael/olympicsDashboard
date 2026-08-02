import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRule } from "@/lib/events";

/**
 * A row in the `event_rules` table: per-event edits to the rulebook TEXT
 * content, keyed by the event `slug` from src/lib/events.ts. Every content
 * column is nullable — a NULL means "fall back to the code default for that
 * field", so the /rules pages merge the static base with this override one
 * field at a time (see applyRuleOverride).
 *
 * Structure (icon, color, type, scoring config) is NOT stored here; the code
 * stays the source of truth for anything that drives scoring or layout.
 */
export interface EventRuleOverride {
  slug: string;
  name: string | null;
  category: string | null;
  description: string | null;
  participants: string | null;
  attempts: string | null;
  equipment: string[] | null;
  rules: string[] | null;
  scoring: string | null;
  setup: string[] | null;
  tips: string[] | null;
  conditions: string[] | null;
  updated_by: string;
  updated_at: string;
}

/** The subset of EventRule fields an admin may edit through /admin/rules. */
export const EDITABLE_RULE_FIELDS = [
  "name",
  "category",
  "description",
  "participants",
  "attempts",
  "equipment",
  "rules",
  "scoring",
  "setup",
  "tips",
  "conditions",
] as const;

/**
 * Merge a stored override onto a static event definition. Only non-null
 * override fields win; everything else (including all structural fields) keeps
 * the code default.
 */
export function applyRuleOverride(
  base: EventRule,
  o?: EventRuleOverride | null
): EventRule {
  if (!o) return base;
  return {
    ...base,
    name: o.name ?? base.name,
    category: o.category ?? base.category,
    description: o.description ?? base.description,
    participants: o.participants ?? base.participants,
    attempts: o.attempts ?? base.attempts,
    equipment: o.equipment ?? base.equipment,
    rules: o.rules ?? base.rules,
    scoring: o.scoring ?? base.scoring,
    setup: o.setup ?? base.setup,
    tips: o.tips ?? base.tips,
    conditions: o.conditions ?? base.conditions,
  };
}

/**
 * Load every override, keyed by slug. `overrides` is always a usable map — it
 * comes back empty when the table is missing (migration not yet run) so the
 * public pages silently fall back to the static defaults. `error` carries the
 * reason so the admin editor can say why saving won't work instead of failing
 * quietly.
 */
export async function fetchRuleOverrides(supabase: SupabaseClient): Promise<{
  overrides: Record<string, EventRuleOverride>;
  error: string | null;
}> {
  const { data, error } = await supabase.from("event_rules").select("*");
  if (error || !data) return { overrides: {}, error: error?.message ?? null };
  const map: Record<string, EventRuleOverride> = {};
  for (const row of data as EventRuleOverride[]) map[row.slug] = row;
  return { overrides: map, error: null };
}
