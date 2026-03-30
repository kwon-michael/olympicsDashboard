"use client";

import { useEffect, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import type { Announcement } from "@/lib/types";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const pushAnnouncement = useAppStore((s) => s.pushAnnouncement);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to announcements
    const announcementChannel = supabase
      .channel("announcements")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => {
          const announcement = payload.new as Announcement;
          pushAnnouncement(announcement);
        }
      )
      .subscribe();

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

    return () => {
      supabase.removeChannel(announcementChannel);
      supabase.removeChannel(scoresChannel);
      supabase.removeChannel(teamsChannel);
    };
  }, [pushAnnouncement]);

  return <>{children}</>;
}
