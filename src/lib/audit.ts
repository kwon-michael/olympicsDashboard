import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAudit(
  supabase: SupabaseClient,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>
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
  });
}
