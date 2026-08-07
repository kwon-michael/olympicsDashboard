// ============================================
// App settings — the admin-controlled site switches
// ============================================
// A single row (see supabase/app_settings.sql) holding flags that change what
// the public site shows. Right now that's one switch: `leaderboard_hidden`.
//
// Hiding the leaderboard changes *display only*. Every scoring path — the score
// tools, penalties, solo results, both tournaments — keeps writing and
// recomputing exactly as before, and admins keep seeing the live board while
// it's hidden. Nothing in this module is wired into `computeStandings`, and it
// should stay that way: a hidden board that also stopped counting would quietly
// diverge from the real result.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppSettings, UserRole } from "@/lib/types";

/** The single settings row is pinned to id 1. */
const SETTINGS_ID = 1;

/**
 * What the site falls back to when the row can't be read (the table hasn't been
 * created yet, or the request failed). Showing the board is the safer default:
 * a settings hiccup shouldn't take the leaderboard down mid-event.
 */
export const DEFAULT_SETTINGS: Omit<AppSettings, "updated_at" | "updated_by"> = {
  id: SETTINGS_ID,
  leaderboard_hidden: false,
};

export async function fetchAppSettings(
  supabase: SupabaseClient
): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_SETTINGS, updated_at: "", updated_by: null };
  }
  return data as AppSettings;
}

/**
 * Flip the leaderboard switch. Admin-only at the database level (RLS), so a
 * non-admin call fails rather than silently doing nothing.
 */
export async function setLeaderboardHidden(
  supabase: SupabaseClient,
  hidden: boolean
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("app_settings").upsert({
    id: SETTINGS_ID,
    leaderboard_hidden: hidden,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Who is allowed to see the standings while they're hidden.
 *
 * Admins only — not volunteers. Volunteers record results all day and a phone
 * left open on the desk is exactly how a hidden board leaks back into the room.
 */
export function canBypassLeaderboardHide(
  role: UserRole | null | undefined
): boolean {
  return role === "admin";
}

/**
 * Whether this viewer should be shown the standings at all.
 *
 * Everything gated on the hide — the leaderboard page, the point totals on
 * /teams, the score breakdown on a team page — goes through this one call, so
 * they can't drift apart and leave the totals showing on a page somebody forgot.
 */
export function canViewLeaderboard(
  hidden: boolean,
  role: UserRole | null | undefined
): boolean {
  return !hidden || canBypassLeaderboardHide(role);
}
