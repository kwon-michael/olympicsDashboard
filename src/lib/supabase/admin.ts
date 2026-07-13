import { createClient } from "@supabase/supabase-js";

// Service-role client for privileged, server-only operations (e.g. creating
// admin accounts). NEVER import this into client components — the service
// role key bypasses Row Level Security.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase service role is not configured.");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
