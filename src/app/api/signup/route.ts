import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Creates an admin account. Gated by a shared access code so that only people
// who have been given the code can create an account — no schema edits required
// to onboard a new admin.
export async function POST(request: Request) {
  const expectedCode = process.env.ADMIN_SIGNUP_CODE;
  if (!expectedCode) {
    return NextResponse.json(
      { error: "Sign-up is not configured. Contact an administrator." },
      { status: 500 }
    );
  }

  let body: { email?: string; password?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const code = body.code ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (code !== expectedCode) {
    return NextResponse.json(
      { error: "Invalid access code." },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();

  const { data, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !data.user) {
    const message = createError?.message ?? "Could not create account.";
    // Supabase returns a 422 for an already-registered email.
    const status = createError?.status === 422 ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  // The handle_new_user() trigger created the profile with the default role;
  // promote it to admin now (service role bypasses RLS).
  const { error: roleError } = await supabase
    .from("users")
    .update({ role: "admin" })
    .eq("id", data.user.id);

  if (roleError) {
    // Roll back the half-created account so the code can be retried cleanly.
    await supabase.auth.admin.deleteUser(data.user.id);
    return NextResponse.json(
      { error: "Could not finish creating your account. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
