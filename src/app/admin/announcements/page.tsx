"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Megaphone,
  Send,
  Eye,
  Trash2,
  CheckCircle,
  AlertCircle,
  Info,
  AlertTriangle,
  PartyPopper,
  Zap,
  Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PageTransition } from "@/components/ui/page-transition";
import type { Announcement, AnnouncementType } from "@/lib/types";

const typeConfig: Record<
  AnnouncementType,
  { label: string; icon: React.ElementType; color: string; description: string }
> = {
  general: {
    label: "General",
    icon: Info,
    color: "#3B82F6",
    description: "Standard announcement for all participants",
  },
  event_starting: {
    label: "Event Starting",
    icon: Trophy,
    color: "#F5A623",
    description: "Notify participants that an event is about to begin",
  },
  score_update: {
    label: "Score Update",
    icon: Zap,
    color: "#E94560",
    description: "Alert about score changes or new results posted",
  },
  urgent: {
    label: "Urgent",
    icon: AlertTriangle,
    color: "#EF4444",
    description: "Important time-sensitive announcement",
  },
  celebration: {
    label: "Celebration",
    icon: PartyPopper,
    color: "#A855F7",
    description: "Celebrate achievements, milestones, or victories",
  },
};

export default function AdminAnnouncementsPage() {
  const supabase = createClient();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [announcementType, setAnnouncementType] =
    useState<AnnouncementType>("general");

  useEffect(() => {
    async function fetchAnnouncements() {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setAnnouncements((data as Announcement[]) ?? []);
      setLoading(false);
    }
    fetchAnnouncements();
  }, []);

  async function publishAnnouncement() {
    if (!title.trim() || !body.trim()) {
      setFeedback({
        type: "error",
        message: "Title and body are required.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error, data } = await supabase
      .from("announcements")
      .insert({
        title: title.trim(),
        body: body.trim(),
        type: announcementType,
        author_id: user?.id,
      })
      .select()
      .single();

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({
        type: "success",
        message: "Announcement published! It will appear to all users via real-time.",
      });
      setTitle("");
      setBody("");
      setAnnouncementType("general");
      setPreview(false);
      if (data) {
        setAnnouncements([data as Announcement, ...announcements]);
      }
    }
    setSaving(false);
  }

  async function deleteAnnouncement(id: string) {
    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);
    if (!error) {
      setAnnouncements(announcements.filter((a) => a.id !== id));
    }
  }

  const currentTypeConfig = typeConfig[announcementType];
  const TypeIcon = currentTypeConfig.icon;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-coral/10 flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-coral" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              ANNOUNCEMENTS
            </h1>
            <p className="text-sm text-muted">
              Compose and broadcast announcements
            </p>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <p className="text-sm font-medium">{feedback.message}</p>
          </motion.div>
        )}

        {/* Composer */}
        <section className="mb-10">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">
            COMPOSE
          </h2>

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            {/* Type Selector */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(
                  Object.entries(typeConfig) as [
                    AnnouncementType,
                    (typeof typeConfig)[AnnouncementType],
                  ][]
                ).map(([type, config]) => {
                  const Icon = config.icon;
                  const isActive = announcementType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setAnnouncementType(type)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all text-xs ${
                        isActive
                          ? "border-current bg-current/5"
                          : "border-border hover:border-foreground/20"
                      }`}
                      style={
                        isActive ? { color: config.color } : undefined
                      }
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: config.color }}
                      />
                      <span className={isActive ? "font-semibold" : "text-muted"}>
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted mt-2">
                {currentTypeConfig.description}
              </p>
            </div>

            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Relay Race starts in 10 minutes!"
            />

            <Textarea
              label="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your announcement message..."
              rows={4}
            />

            {/* Preview */}
            {preview && title && body && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl border-2 p-4"
                style={{
                  borderColor: currentTypeConfig.color,
                  backgroundColor: currentTypeConfig.color + "08",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <TypeIcon
                    className="w-5 h-5"
                    style={{ color: currentTypeConfig.color }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: currentTypeConfig.color }}
                  >
                    {currentTypeConfig.label}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  {title}
                </h3>
                <p className="text-sm text-muted mt-1">{body}</p>
              </motion.div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPreview(!preview)}
                className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
              >
                <Eye className="w-4 h-4" />
                {preview ? "Hide Preview" : "Preview"}
              </button>

              <Button onClick={publishAnnouncement} loading={saving}>
                <Send className="w-4 h-4 mr-1" />
                Publish
              </Button>
            </div>
          </div>
        </section>

        {/* Previous Announcements */}
        <section>
          <h2 className="font-display text-lg font-bold text-foreground mb-4">
            HISTORY
          </h2>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="text-center text-muted py-8 text-sm">
                Loading...
              </div>
            ) : announcements.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">
                No announcements published yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {announcements.map((ann) => {
                  const config = typeConfig[ann.type as AnnouncementType] ?? typeConfig.general;
                  const AnnIcon = config.icon;
                  return (
                    <div
                      key={ann.id}
                      className="px-4 py-4 flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <AnnIcon
                          className="w-5 h-5 mt-0.5 shrink-0"
                          style={{ color: config.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: config.color + "15",
                                color: config.color,
                              }}
                            >
                              {config.label}
                            </span>
                            <span className="text-xs text-muted">
                              {new Date(ann.created_at).toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-semibold text-foreground text-sm truncate">
                            {ann.title}
                          </h4>
                          <p className="text-xs text-muted line-clamp-2">
                            {ann.body}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAnnouncement(ann.id)}
                        className="text-muted hover:text-danger transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
