"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, Users, Sparkles, ArrowLeft, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/ui/page-transition";
import { logActivity } from "@/lib/audit";
import Link from "next/link";

const presetColors = [
  "#E94560",
  "#3B82F6",
  "#22C55E",
  "#F5A623",
  "#A855F7",
  "#06B6D4",
  "#F43F5E",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
];

export default function CreateTeamPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(presetColors[0]);
  const [motto, setMotto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingTeam, setExistingTeam] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Check if user is already on a team
  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }

      const { data } = await supabase
        .from("team_members")
        .select("team:teams(id, name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (data?.team) {
        const team = data.team as unknown as { id: string; name: string };
        setExistingTeam(team.name);
      }
      setChecking(false);
    }
    check();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (name.length < 3 || name.length > 30) {
      setError("Team name must be between 3 and 30 characters");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // Check again in case they joined a team in another tab
    const { count } = await supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) > 0) {
      setError("You are already on a team. Leave your current team before creating a new one.");
      setLoading(false);
      return;
    }

    // Create team
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name,
        color,
        motto: motto || null,
        captain_id: user.id,
      })
      .select()
      .single();

    if (teamError) {
      if (teamError.code === "23505") {
        setError("A team with this name already exists");
      } else {
        setError(teamError.message);
      }
      setLoading(false);
      return;
    }

    // Add captain as team member
    await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: user.id,
    });

    logActivity(supabase, "create_team", { team_name: name });
    router.push(`/teams/${team.id}`);
  };

  return (
    <PageTransition className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Teams
      </Link>

      <div className="bg-card rounded-2xl border border-border p-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">
            CREATE YOUR TEAM
          </h1>
          <p className="text-muted mt-2">
            Form your squad and represent your corner of the neighborhood
          </p>
        </div>

        {checking ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
          </div>
        ) : existingTeam ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-foreground mb-2">
              ALREADY ON A TEAM
            </h3>
            <p className="text-muted mb-6">
              You are currently a member of <span className="font-semibold text-foreground">{existingTeam}</span>.
              Leave your current team before creating a new one.
            </p>
            <Link href="/teams">
              <Button variant="outline">Back to Teams</Button>
            </Link>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Name */}
          <Input
            id="name"
            label="Team Name"
            placeholder="The Lightning Bolts"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            error={error}
          />
          <p className="text-xs text-muted -mt-4">
            {name.length}/30 characters
          </p>

          {/* Color Picker */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              <Palette className="w-4 h-4 inline mr-1" />
              Team Color
            </label>
            <div className="flex flex-wrap gap-2">
              {presetColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg transition-all ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-foreground scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted">Custom:</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <span className="text-xs font-mono text-muted">{color}</span>
            </div>
          </div>

          {/* Motto */}
          <Textarea
            id="motto"
            label="Team Motto (optional)"
            placeholder="Victory or nothing!"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            maxLength={100}
            rows={2}
          />
          <p className="text-xs text-muted -mt-4">
            {motto.length}/100 characters
          </p>

          {/* Preview */}
          <div>
            <label className="text-sm font-semibold text-foreground mb-2 block">
              <Sparkles className="w-4 h-4 inline mr-1" />
              Preview
            </label>
            <div className="bg-background rounded-xl border border-border p-4">
              <div
                className="h-1 rounded-full mb-4"
                style={{ backgroundColor: color }}
              />
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: color }}
                >
                  {name ? name.charAt(0).toUpperCase() : "?"}
                </div>
                <div>
                  <p className="font-display text-lg font-bold">
                    {name || "Your Team Name"}
                  </p>
                  {motto && (
                    <p className="text-xs text-muted italic">
                      &ldquo;{motto}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            <Users className="w-5 h-5" />
            Create Team
          </Button>
        </form>
        )}
      </div>
    </PageTransition>
  );
}
