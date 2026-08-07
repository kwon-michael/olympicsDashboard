"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchAppSettings, setLeaderboardHidden } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { useAppStore } from "@/lib/store";

/**
 * The switch that takes the standings off the public site — for the finish, or
 * any stretch where the organisers would rather the room wasn't watching the
 * numbers move.
 *
 * Self-gating like TieAlert: admin-only (it's an admin-only RLS write), so it
 * renders nothing for volunteers and for an admin previewing the volunteer view.
 *
 * Scoring keeps running underneath — that's the whole point of the switch, and
 * the copy says so, because "hidden" and "paused" are easy to confuse when
 * someone else is working the score desk.
 */
export function LeaderboardVisibilityCard({ className }: { className?: string }) {
  const user = useAppStore((s) => s.user);
  const viewAsVolunteer = useAppStore((s) => s.viewAsVolunteer);
  const enabled = user?.role === "admin" && !viewAsVolunteer;

  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    const settings = await fetchAppSettings(createClient());
    setHidden(settings.leaderboard_hidden);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, [load]);

  if (!enabled) return null;

  const toggle = async () => {
    const next = !hidden;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      await setLeaderboardHidden(supabase, next);
      setHidden(next);
      // Not given a revert snapshot: app_settings isn't in the audit page's
      // revertible-tables allowlist, and this switch is a single click to put
      // back anyway.
      await logAudit(supabase, "update", "app_settings", "1", {
        title: next ? "Leaderboard hidden" : "Leaderboard shown",
        leaderboard_hidden: next,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        hidden ? "border-gold/40 bg-gold/[0.07]" : "border-border bg-card"
      } ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              hidden ? "bg-gold/15" : "bg-foreground/[0.04]"
            }`}
          >
            {hidden ? (
              <EyeOff className="w-5 h-5 text-gold" />
            ) : (
              <Eye className="w-5 h-5 text-muted" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Public leaderboard
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {loading
                ? "Checking…"
                : hidden
                  ? "Hidden. Visitors see a “leaderboard hidden” message on the leaderboard and no point totals on the team pages. You still see the live board."
                  : "Visible to everyone. Hide it to keep the standings under wraps — points keep being recorded and deducted either way."}
            </p>
            {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
          </div>
        </div>

        <button
          onClick={toggle}
          disabled={loading || saving}
          className={`flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
            hidden
              ? "bg-gold text-navy hover:bg-gold/90"
              : "border border-border text-muted hover:border-foreground/20 hover:text-foreground"
          }`}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : hidden ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
          {hidden ? "Show leaderboard" : "Hide leaderboard"}
        </button>
      </div>
    </div>
  );
}
