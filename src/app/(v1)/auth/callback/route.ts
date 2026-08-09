import { createClient } from "@/lib/supabase/server";
import { canSignIn } from "@/lib/auth";
import { NextResponse } from "next/server";

// Account setup/recovery redirects must stay reachable even for users who
// aren't admins yet, so they can create a password. Actual app access is
// still gated by middleware + the login page.
const SETUP_REDIRECTS = ["/set-password", "/reset-password"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const isSetupFlow = SETUP_REDIRECTS.some((p) => redirect.startsWith(p));

      if (!isSetupFlow && data.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (!canSignIn(profile?.role)) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=not_admin`);
        }
      }

      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Auth code exchange failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
