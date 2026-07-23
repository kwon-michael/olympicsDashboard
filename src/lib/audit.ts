import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Snapshot that makes an audit entry revertible from the Activity Logs page.
 * - `table`/`rowId` identify the exact row the action touched.
 * - `before` is the state to restore on revert (changed columns for an update,
 *   the full row for a delete).
 * - `after` is kept for reference. Omit the whole snapshot to log a
 *   non-revertible entry.
 */
export interface AuditSnapshot {
  table?: string;
  rowId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export async function logAudit(
  supabase: SupabaseClient,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
  snapshot?: AuditSnapshot
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("audit_log").insert({
    actor_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ?? null,
    table_name: snapshot?.table ?? null,
    row_id: snapshot?.rowId ?? null,
    before: snapshot?.before ?? null,
    after: snapshot?.after ?? null,
  });
}

export async function logActivity(
  supabase: SupabaseClient,
  action: string,
  metadata?: Record<string, unknown>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("user_activity").insert({
    user_id: user.id,
    action,
    metadata: metadata ?? null,
  });
}
