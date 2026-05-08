"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, Trophy, AlertTriangle, Zap, PartyPopper } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import type { Announcement, AnnouncementType } from "@/lib/types";

const typeConfig: Record<
  AnnouncementType,
  { color: string; icon: React.ElementType; autoDismiss: number | null }
> = {
  general: { color: "#3B82F6", icon: Info, autoDismiss: 12000 },
  event_starting: { color: "#F5A623", icon: Zap, autoDismiss: null },
  score_update: { color: "#E94560", icon: Trophy, autoDismiss: 8000 },
  urgent: { color: "#EF4444", icon: AlertTriangle, autoDismiss: null },
  celebration: { color: "#A855F7", icon: PartyPopper, autoDismiss: 10000 },
};

export function AnnouncementOverlay() {
  const {
    activeAnnouncements,
    announcementQueue,
    pushAnnouncement,
    dismissAnnouncement,
  } = useAppStore();
  const [current, setCurrent] = useState(activeAnnouncements);

  // On mount, fetch the latest announcement so users who arrive late still see it
  useEffect(() => {
    async function fetchLatest() {
      const supabase = createClient();
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const ann = data as Announcement;
        const dismissed = sessionStorage.getItem("dismissed-announcements");
        const dismissedIds = dismissed ? JSON.parse(dismissed) : [];
        if (!dismissedIds.includes(ann.id)) {
          pushAnnouncement(ann);
        }
      }
    }

    fetchLatest();
  }, []);

  // Process queue
  const processQueue = useCallback(() => {
    const queue = useAppStore.getState().announcementQueue;
    if (queue.length === 0) return;

    const next = queue[0];
    const active = useAppStore.getState().activeAnnouncements;
    if (active.some((a) => a.id === next.id)) {
      useAppStore.setState((state) => ({
        announcementQueue: state.announcementQueue.slice(1),
      }));
      return;
    }

    useAppStore.setState((state) => ({
      activeAnnouncements: [...state.activeAnnouncements, next],
      announcementQueue: state.announcementQueue.slice(1),
    }));
  }, []);

  useEffect(() => {
    const interval = setInterval(processQueue, 1000);
    return () => clearInterval(interval);
  }, [processQueue]);

  useEffect(() => {
    setCurrent(activeAnnouncements);
  }, [activeAnnouncements]);

  // Auto-dismiss timers
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    current.forEach((ann) => {
      const config = typeConfig[ann.type];
      if (config.autoDismiss) {
        timers.push(
          setTimeout(() => handleDismiss(ann.id), config.autoDismiss)
        );
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [current]);

  function handleDismiss(id: string) {
    dismissAnnouncement(id);
    try {
      const stored = sessionStorage.getItem("dismissed-announcements");
      const ids: string[] = stored ? JSON.parse(stored) : [];
      if (!ids.includes(id)) {
        ids.push(id);
        if (ids.length > 20) ids.shift();
        sessionStorage.setItem("dismissed-announcements", JSON.stringify(ids));
      }
    } catch {}
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {current.map((announcement) => {
          const config = typeConfig[announcement.type];
          const Icon = config.icon;

          return (
            <motion.div
              key={announcement.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="bg-card/95 backdrop-blur-md rounded-xl border border-border shadow-lg pointer-events-auto"
            >
              {/* Color accent */}
              <div
                className="h-0.5 rounded-t-xl"
                style={{ backgroundColor: config.color }}
              />

              <div className="px-4 py-3 flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: config.color + "12" }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: config.color }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground leading-tight">
                    {announcement.title}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 line-clamp-2 leading-snug">
                    {announcement.body}
                  </p>
                </div>

                <button
                  onClick={() => handleDismiss(announcement.id)}
                  className="p-1 rounded-md text-muted hover:text-foreground hover:bg-background transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
