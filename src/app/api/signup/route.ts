import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Creates an admin or volunteer account, depending on which shared access code
// was entered. The code gates who can create an account — no schema edits
// required to onboard a new admin/volunteer. The admin code comes from
// ADMIN_SIGNUP_CODE; the volunteer code from VOLUNTEER_SIGNUP_CODE (defaulting
// to a known value so volunteers can sign up without extra configuration).
export async function POST(request: Request) {
  const adminCode = process.env.ADMIN_SIGNUP_CODE;
  const volunteerCode = process.env.VOLUNTEER_SIGNUP_CODE ?? "bestvolunteerever";
  if (!adminCode && !volunteerCode) {
    return NextResponse.json(
      { error: "Sign-up is not configured. Contact an administrator." },
      { status: 500 }
    );
  }

  let body: {
    email?: string;
    password?: string;
    code?: string;
    firstName?: string;
    lastName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const code = body.code ?? "";
  const firstName = body.firstName?.trim() ?? "";
  const lastName = body.lastName?.trim() ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First and last name are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  // The entered code decides the role. Admin code is checked first so that if
  // the two codes were ever set to the same value, admin wins.
  let role: "admin" | "volunteer";
  if (adminCode && code === adminCode) {
    role = "admin";
  } else if (volunteerCode && code === volunteerCode) {
    role = "volunteer";
  } else {
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
  // set the code's role plus the name now (service role bypasses RLS). We also
  // mark the profile complete so the new account lands straight on the dashboard
  // instead of being bounced through the profile-setup gate.
  const { error: roleError } = await supabase
    .from("users")
    .update({
      role,
      first_name: firstName,
      last_name: lastName,
      display_name: `${firstName} ${lastName}`,
      profile_completed: true,
    })
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
