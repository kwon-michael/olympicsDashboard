"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  Trophy,
  Link as LinkIcon,
  Edit3,
  UserPlus,
  Crown,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScoreCard } from "@/components/ui/score-card";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import type { Team, TeamMember, User, Score, Event } from "@/lib/types";
import Link from "next/link";

export default function TeamProfilePage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<(TeamMember & { user: User })[]>([]);
  const [scores, setScores] = useState<(Score & { event: Event })[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMotto, setEditMotto] = useState("");
  const [editColor, setEditColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const loadTeam = async () => {
      const supabase = createClient();

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();
        if (profile) setCurrentUser(profile);
      }

      // Load team
      const { data: teamData } = await supabase
        .from("teams")
        .select("*")
        .eq("id", teamId)
        .single();

      if (!teamData) {
        router.push("/teams");
        return;
      }

      setTeam(teamData);
      setEditName(teamData.name);
      setEditMotto(teamData.motto || "");
      setEditColor(teamData.color);

      // Load members
      const { data: membersData } = await supabase
        .from("team_members")
        .select("*, user:users(*)")
        .eq("team_id", teamId);

      if (membersData) {
        setMembers(membersData as any);
        if (authUser) {
          setIsMember(membersData.some((m) => m.user_id === authUser.id));
          setIsCaptain(teamData.captain_id === authUser.id);
        }
      }

      // Load team scores
      const { data: scoresData } = await supabase
        .from("scores")
        .select("*, event:events(*)")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

      if (scoresData) setScores(scoresData as any);

      setLoading(false);
    };

    loadTeam();
  }, [teamId, router]);

  const handleJoin = async () => {
    setJoining(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

    await supabase.from("team_members").insert({
      team_id: teamId,
      user_id: user.id,
    });

    window.location.reload();
  };

  const handleSave = async () => {
    if (!team) return;
    const supabase = createClient();

    await supabase
      .from("teams")
      .update({
        name: editName,
        motto: editMotto || null,
        color: editColor,
      })
      .eq("id", team.id);

    setTeam({ ...team, name: editName, motto: editMotto, color: editColor });
    setEditing(false);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/teams/${teamId}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!team) return null;

  const totalPoints = scores.reduce((sum, s) => sum + s.value, 0);

  return (
    <PageTransition className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Teams
      </Link>

      {/* Team Header */}
      <div
        className="relative rounded-2xl overflow-hidden mb-8"
        style={{ backgroundColor: team.color + "15" }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-2"
          style={{ backgroundColor: team.color }}
        />
        <div className="p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg"
              style={{ backgroundColor: team.color }}
            >
              {team.avatar_url ? (
                <img
                  src={team.avatar_url}
                  alt={team.name}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                team.name.charAt(0).toUpperCase()
              )}
            </div>

            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Team Name"
                  />
                  <Textarea
                    value={editMotto}
                    onChange={(e) => setEditMotto(e.target.value)}
                    placeholder="Team Motto"
                    rows={1}
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-10 h-10 rounded border border-border cursor-pointer"
                    />
                    <Button size="sm" onClick={handleSave}>
                      Save Changes
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-3xl font-bold text-foreground">
                    {team.name}
                  </h1>
                  {team.motto && (
                    <p className="text-muted italic mt-1">
                      &ldquo;{team.motto}&rdquo;
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    <span className="flex items-center gap-1 text-sm text-muted">
                      <Users className="w-4 h-4" />
                      {members.length} members
                    </span>
                    <span className="flex items-center gap-1 text-sm text-muted">
                      <Trophy className="w-4 h-4" />
                      {totalPoints} points
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {isCaptain && !team.is_locked && !editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={copyInviteLink}>
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copied!" : "Invite Link"}
              </Button>
              {!isMember && currentUser && (
                <Button size="sm" loading={joining} onClick={handleJoin}>
                  <UserPlus className="w-4 h-4" />
                  Join Team
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roster */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-coral" />
            ROSTER
          </h2>
          <StaggerContainer className="space-y-3">
            {members.map((member) => (
              <StaggerItem key={member.id}>
                <div className="flex items-center gap-3 p-3 bg-background rounded-xl">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: team.color }}
                  >
                    {member.user?.display_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {member.user?.display_name || "Unknown"}
                    </p>
                    {member.event_nickname && (
                      <p className="text-xs text-muted">
                        &ldquo;{member.event_nickname}&rdquo;
                      </p>
                    )}
                  </div>
                  {member.user_id === team.captain_id && (
                    <Crown className="w-4 h-4 text-gold" />
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        {/* Team Scores */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" />
            SCORES
          </h2>
          {scores.length > 0 ? (
            <div className="space-y-3">
              {scores.map((score) => (
                <ScoreCard
                  key={score.id}
                  teamName={team.name}
                  teamColor={team.color}
                  points={score.value}
                  eventName={score.event?.name}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-muted">No scores recorded yet</p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
