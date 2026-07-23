import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Fully removes a user account — the auth login and the public.users profile —
// on behalf of an admin. Deleting the account is done with the service role
// because there is no RLS DELETE policy on public.users, and because the login
// itself lives in auth.users (only the admin API can remove it).
//
// public.users is referenced by several NOT NULL / no-cascade foreign keys, so
// a naive delete would either error or destructively cascade. We handle each
// reference deliberately: shared/authored content (events, schedule, teams,
// announcements) is reassigned to the acting admin so it survives, while the
// target's own personal rows (their participation scores, action log, activity)
// are removed. Only then can auth.admin.deleteUser cascade away the profile.
export async function POST(request: Request) {
  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const targetId = body.userId?.trim();
  if (!targetId) {
    return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  }

  // Authorize: the caller must be a signed-in admin.
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can remove accounts." },
      { status: 403 }
    );
  }

  // Deleting your own account would lock you out; block it defensively even
  // though the UI hides the option.
  if (targetId === caller.id) {
    return NextResponse.json(
      { error: "You can't remove your own account." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 1. Reassign authored/owned content to the acting admin so it isn't lost
  //    (these columns are NOT NULL, so they can't simply be nulled).
  const reassignOwner = [
    { table: "events", column: "created_by" },
    { table: "schedule_entries", column: "created_by" },
    { table: "teams", column: "captain_id" },
    { table: "announcements", column: "author_id" },
  ] as const;
  for (const { table, column } of reassignOwner) {
    const { error } = await admin
      .from(table)
      .update({ [column]: caller.id })
      .eq(column, targetId);
    // Tolerate tables that no longer exist in this deployment.
    if (error && !isMissingTable(error)) {
      return NextResponse.json(
        { error: `Failed to reassign ${table}: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // 2. Null out the nullable references to the target.
  const clearRefs = [
    { table: "scores", column: "recorded_by" },
    { table: "audit_log", column: "reverted_by" },
  ] as const;
  for (const { table, column } of clearRefs) {
    const { error } = await admin
      .from(table)
      .update({ [column]: null })
      .eq(column, targetId);
    if (error && !isMissingTable(error)) {
      return NextResponse.json(
        { error: `Failed to clear ${table}: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // 3. Delete the target's own personal rows (NOT NULL refs that belong solely
  //    to this user and shouldn't outlive the account). The audit_log and
  //    user_activity trails are intentionally NOT deleted here — their FKs are
  //    ON DELETE SET NULL and each row snapshots the actor's name, so the
  //    history of what the account did is preserved after removal.
  const deleteOwn = [
    { table: "scores", column: "user_id" },
    { table: "team_members", column: "user_id" },
  ] as const;
  for (const { table, column } of deleteOwn) {
    const { error } = await admin.from(table).delete().eq(column, targetId);
    if (error && !isMissingTable(error)) {
      return NextResponse.json(
        { error: `Failed to remove ${table}: ${error.message}` },
        { status: 500 }
      );
    }
  }

  // 4. Remove the login. Deleting the auth user cascades to public.users (and
  //    any remaining ON DELETE CASCADE dependents).
  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
  if (deleteError) {
    return NextResponse.json(
      { error: `Failed to delete account: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

// Postgres reports an unknown relation as error code 42P01; the Supabase client
// surfaces it in the message. Treat it as "nothing to clean up here".
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    /does not exist/i.test(error.message ?? "") ||
    /Could not find the table/i.test(error.message ?? "")
  );
}
