import { createBrowserClient } from "@supabase/ssr";

// NEXT_PUBLIC_* values are inlined at build time. When they're missing we throw
// instead of silently falling back to a local URL — otherwise the deployed site
// quietly talks to a nonexistent server and every page renders blank with no
// error. Failing loudly here surfaces the misconfiguration in the build logs
// (and the browser console) instead.
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase configuration: set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (in .env.local for local dev, or the " +
        "Netlify site environment variables for deploys), then rebuild — these " +
        "values are inlined at build time, so changing them requires a new build."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
