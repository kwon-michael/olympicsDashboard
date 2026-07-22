"use client";

import { useEffect, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";

// Hydrates the app store with the signed-in user on every load and keeps it in
// sync with Supabase auth events. Without this, the store starts empty on a full
// page load (e.g. right after the login redirect, or a hard refresh on any
// page), so the navbar would show "Sign In" for an already-authenticated user
// until some page happened to call setUser.
export function AuthProvider({ children }: { children: ReactNode }) {
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const loadProfile = async (userId: string) => {
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      if (!cancelled) setUser(profile ?? null);
    };

    // Initial hydration.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      if (user) {
        loadProfile(user.id);
      } else {
        setUser(null);
      }
    });

    // Keep the store in sync as the session changes (sign in / sign out /
    // token refresh in another tab).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setUser]);

  return <>{children}</>;
}
