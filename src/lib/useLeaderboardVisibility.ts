"use client";

// ============================================
// useLeaderboardVisibility — the one hook the public pages gate on
// ============================================
// Answers "should this browser render the standings?" for the leaderboard page,
// the team list and a team's profile. See src/lib/settings.ts for what the
// switch does (and doesn't) affect.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAppSettings, canViewLeaderboard } from "@/lib/settings";
import type { UserRole } from "@/lib/types";

export interface LeaderboardVisibility {
  /** The admin switch itself — true when the board is hidden from the public. */
  hidden: boolean;
  /** Whether *this* viewer may see the standings (admins can, while hidden). */
  canView: boolean;
  /** True when the viewer is seeing a board the public currently can't. */
  isAdminPreview: boolean;
  /**
   * Both the switch and the viewer's role are still being resolved. Callers must
   * render a skeleton until this clears — rendering the board first and hiding
   * it a moment later would flash the standings the switch exists to hide.
   */
  loading: boolean;
}

/** Resolves the signed-in user's role, or null when nobody is signed in. */
async function fetchViewerRole(
  supabase: ReturnType<typeof createClient>
): Promise<UserRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.role as UserRole | undefined) ?? null;
}

/**
 * Resolved fresh here rather than read off the app store, because the store's
 * user is hydrated asynchronously and starts as null: an admin would otherwise
 * be shown the "hidden" message for a beat before the board appeared.
 *
 * Re-reads on the `settings-updated` event the realtime provider dispatches, so
 * flipping the switch reaches every open page without a refresh.
 */
export function useLeaderboardVisibility(): LeaderboardVisibility {
  const [state, setState] = useState({
    hidden: false,
    role: null as UserRole | null,
    loading: true,
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const [settings, role] = await Promise.all([
      fetchAppSettings(supabase),
      fetchViewerRole(supabase),
    ]);
    setState({ hidden: settings.leaderboard_hidden, role, loading: false });
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, [load]);

  const canView = canViewLeaderboard(state.hidden, state.role);
  return {
    hidden: state.hidden,
    canView,
    isAdminPreview: state.hidden && canView,
    loading: state.loading,
  };
}
