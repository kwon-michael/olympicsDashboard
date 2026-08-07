"use client";

import { useEffect, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const supabase = createClient();

    // Subscribe to score changes (for leaderboard refresh)
    const scoresChannel = supabase
      .channel("scores")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        () => {
          // Components will handle refetch via React Query invalidation
          window.dispatchEvent(new CustomEvent("scores-updated"));
        }
      )
      .subscribe();

    // Subscribe to team changes
    const teamsChannel = supabase
      .channel("teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => {
          window.dispatchEvent(new CustomEvent("teams-updated"));
        }
      )
      .subscribe();

    const scheduleChannel = supabase
      .channel("schedule")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_entries" },
        () => {
          window.dispatchEvent(new CustomEvent("schedule-updated"));
        }
      )
      .subscribe();

    // Admin site switches — hiding or revealing the leaderboard should land on
    // every phone in the room at once, without anyone being told to refresh.
    const settingsChannel = supabase
      .channel("app-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => {
          window.dispatchEvent(new CustomEvent("settings-updated"));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scoresChannel);
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(scheduleChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  return <>{children}</>;
}
