"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  User,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonList } from "@/components/ui/skeleton";
import { logAudit } from "@/lib/audit";
import {
  soloEvents,
  teamEvents,
  getEventBySlug,
  type EventRule,
} from "@/lib/events";
import {
  applyRuleOverride,
  fetchRuleOverrides,
  type EventRuleOverride,
} from "@/lib/rules";

/* ------------------------------------------------------------------ */
/*  Form <-> data helpers                                              */
/* ------------------------------------------------------------------ */

interface RuleForm {
  name: string;
  category: string;
  description: string;
  participants: string;
  attempts: string;
  rules: string; // one item per line
  setup: string; // one item per line
  equipment: string; // one item per line
  scoring: string;
  conditions: string; // one item per line
  tips: string; // one item per line
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function linesToArray(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Build the editable form from the effective (base + override) event. */
function formFromEvent(ev: EventRule): RuleForm {
  return {
    name: ev.name,
    category: ev.category,
    description: ev.description,
    participants: ev.participants,
    attempts: ev.attempts ?? "",
    rules: ev.rules.join("\n"),
    setup: ev.setup.join("\n"),
    equipment: ev.equipment.join("\n"),
    scoring: ev.scoring ?? "",
    conditions: (ev.conditions ?? []).join("\n"),
    tips: (ev.tips ?? []).join("\n"),
  };
}

/**
 * Compare a form against the STATIC base and produce the override payload.
 * A field that matches the code default (or is blank) becomes null so it keeps
 * tracking the default. Returns null when nothing differs from the defaults.
 */
function buildOverride(
  base: EventRule,
  form: RuleForm
): Omit<EventRuleOverride, "slug" | "updated_by" | "updated_at"> | null {
  const scalar = (current: string, def: string | undefined): string | null => {
    const c = current.trim();
    const b = (def ?? "").trim();
    return c === "" || c === b ? null : c;
  };
  const list = (current: string, def: string[] | undefined): string[] | null => {
    const arr = linesToArray(current);
    if (arr.length === 0) return null;
    return arraysEqual(arr, def ?? []) ? null : arr;
  };

  const payload = {
    name: scalar(form.name, base.name),
    category: scalar(form.category, base.category),
    description: scalar(form.description, base.description),
    participants: scalar(form.participants, base.participants),
    attempts: scalar(form.attempts, base.attempts),
    equipment: list(form.equipment, base.equipment),
    rules: list(form.rules, base.rules),
    scoring: scalar(form.scoring, base.scoring),
    setup: list(form.setup, base.setup),
    tips: list(form.tips, base.tips),
    conditions: list(form.conditions, base.conditions),
  };

  const allDefault = Object.values(payload).every((v) => v === null);
  return allDefault ? null : payload;
}

/* ------------------------------------------------------------------ */
/*  Small field components                                             */
/* ------------------------------------------------------------------ */

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted uppercase tracking-wider">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-coral focus:outline-none"
      />
    </label>
  );
}

function AreaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted uppercase tracking-wider">
        {label}
      </span>
      {hint && <span className="ml-2 text-[11px] text-muted">{hint}</span>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground leading-relaxed focus:border-coral focus:outline-none resize-y"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminRulesPage() {
  const supabase = createClient();
  const [overrides, setOverrides] = useState<Record<string, EventRuleOverride>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const map = await fetchRuleOverrides(supabase);
    setOverrides(map);
    setLoading(false);
  }

  function selectEvent(slug: string) {
    const base = getEventBySlug(slug);
    if (!base) return;
    setSelectedSlug(slug);
    setForm(formFromEvent(applyRuleOverride(base, overrides[slug])));
    setFeedback(null);
  }

  function updateForm(patch: Partial<RuleForm>) {
    setForm((f) => (f ? { ...f, ...patch } : f));
  }

  async function handleSave() {
    if (!selectedSlug || !form) return;
    const base = getEventBySlug(selectedSlug);
    if (!base) return;

    setSaving(true);
    setFeedback(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setFeedback({ type: "error", message: "You must be signed in." });
      setSaving(false);
      return;
    }

    const payload = buildOverride(base, form);
    const prior = overrides[selectedSlug] ?? null;

    // Everything matches the code defaults → no override needed. Remove any
    // existing row so the event tracks the defaults again.
    if (!payload) {
      if (prior) {
        const { error } = await supabase
          .from("event_rules")
          .delete()
          .eq("slug", selectedSlug);
        if (error) {
          setFeedback({ type: "error", message: error.message });
          setSaving(false);
          return;
        }
        await logAudit(
          supabase,
          "delete",
          "event_rule",
          selectedSlug,
          { name: base.name },
          { table: "event_rules", rowId: selectedSlug, before: { ...prior } }
        );
      }
      setFeedback({ type: "success", message: `${base.name} reset to defaults.` });
      await load();
      setSaving(false);
      return;
    }

    const row = {
      slug: selectedSlug,
      ...payload,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("event_rules")
      .upsert(row, { onConflict: "slug" });

    if (error) {
      setFeedback({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    await logAudit(
      supabase,
      prior ? "update" : "create",
      "event_rule",
      selectedSlug,
      { name: base.name },
      {
        table: "event_rules",
        rowId: selectedSlug,
        before: prior ? { ...prior } : null,
        after: { ...payload },
      }
    );

    setFeedback({ type: "success", message: `${base.name} rules saved.` });
    await load();
    setSaving(false);
  }

  function handleResetForm() {
    if (!selectedSlug) return;
    const base = getEventBySlug(selectedSlug);
    if (base) setForm(formFromEvent(base));
  }

  const groups: { label: string; icon: typeof User; events: EventRule[] }[] = [
    { label: "Solo Events", icon: User, events: soloEvents },
    { label: "Team Events", icon: Users, events: teamEvents },
  ];

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-sky-500" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              EVENT RULES
            </h1>
            <p className="text-sm text-muted">
              Edit the public rulebook — pick an event, then update its text
            </p>
          </div>
        </div>

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

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Event list */}
          <div className="w-full lg:w-[300px] shrink-0 space-y-6">
            {loading ? (
              <div className="bg-card rounded-xl border border-border p-4">
                <SkeletonList rows={6} />
              </div>
            ) : (
              groups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.label}>
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted uppercase tracking-wider">
                      <GroupIcon className="w-3.5 h-3.5" />
                      {group.label}
                    </div>
                    <div className="space-y-1.5">
                      {group.events.map((ev) => {
                        const edited = !!overrides[ev.slug];
                        const active = selectedSlug === ev.slug;
                        return (
                          <button
                            key={ev.slug}
                            onClick={() => selectEvent(ev.slug)}
                            className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                              active
                                ? "border-coral bg-coral/5"
                                : "border-border bg-card hover:border-foreground/20"
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: ev.color }}
                              />
                              <span className="text-sm font-medium text-foreground truncate">
                                {ev.name}
                              </span>
                            </span>
                            {edited && (
                              <span className="text-[10px] font-semibold text-sky-500 bg-sky-500/10 rounded-full px-2 py-0.5 shrink-0">
                                Edited
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 min-w-0">
            {!form || !selectedSlug ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center text-muted text-sm">
                Select an event to edit its rules.
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <TextField
                    label="Name"
                    value={form.name}
                    onChange={(v) => updateForm({ name: v })}
                  />
                  <TextField
                    label="Category"
                    value={form.category}
                    onChange={(v) => updateForm({ category: v })}
                  />
                </div>
                <AreaField
                  label="Description"
                  value={form.description}
                  onChange={(v) => updateForm({ description: v })}
                  rows={2}
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <TextField
                    label="Participants"
                    value={form.participants}
                    onChange={(v) => updateForm({ participants: v })}
                  />
                  <TextField
                    label="Attempts"
                    value={form.attempts}
                    onChange={(v) => updateForm({ attempts: v })}
                    placeholder="optional"
                  />
                </div>
                <AreaField
                  label="Rules"
                  hint="one rule per line"
                  value={form.rules}
                  onChange={(v) => updateForm({ rules: v })}
                  rows={7}
                />
                <AreaField
                  label="Setup"
                  hint="one item per line"
                  value={form.setup}
                  onChange={(v) => updateForm({ setup: v })}
                />
                <AreaField
                  label="Equipment"
                  hint="one item per line"
                  value={form.equipment}
                  onChange={(v) => updateForm({ equipment: v })}
                />
                <AreaField
                  label="Scoring"
                  hint="descriptive text (does not change point math)"
                  value={form.scoring}
                  onChange={(v) => updateForm({ scoring: v })}
                  rows={3}
                />
                <AreaField
                  label="Conditions"
                  hint="one per line, optional"
                  value={form.conditions}
                  onChange={(v) => updateForm({ conditions: v })}
                />
                <AreaField
                  label="Tips"
                  hint="one per line, optional"
                  value={form.tips}
                  onChange={(v) => updateForm({ tips: v })}
                />

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    onClick={handleResetForm}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Revert to defaults
                  </button>
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? "Saving…" : "Save rules"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Clearing a field restores its built-in default. Icon, color and
                  scoring math stay fixed in code and can&apos;t be edited here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
