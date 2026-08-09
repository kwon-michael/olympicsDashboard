import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Back to the 2026 home rather than `/` — signing out happens inside that
  // site, and `/` is now the next event's front door.
  return NextResponse.redirect(new URL("/2026", process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000"), {
    status: 302,
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/2026", url.origin), {
    status: 302,
  });
}
