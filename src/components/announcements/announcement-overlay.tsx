"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, Trophy, AlertTriangle, Zap, PartyPopper } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { AnnouncementType } from "@/lib/types";

const typeConfig: Record<
  AnnouncementType,
  { bg: string; icon: React.ElementType; autoDismiss: number | null }
> = {
  general: { bg: "bg-info", icon: Info, autoDismiss: 15000 },
  event_starting: { bg: "bg-gold", icon: Zap, autoDismiss: null },
  score_update: { bg: "bg-coral", icon: Trophy, autoDismiss: 8000 },
  urgent: { bg: "bg-danger", icon: AlertTriangle, autoDismiss: null },
  celebration: { bg: "bg-celebration", icon: PartyPopper, autoDismiss: 10000 },
};

export function AnnouncementOverlay() {
  const {
    activeAnnouncements,
    announcementQueue,
    dismissAnnouncement,
    pushAnnouncement: _,
  } = useAppStore();
  const [current, setCurrent] = useState(activeAnnouncements);

  // Process queue: show one at a time with 1s gap
  const processQueue = useCallback(() => {
    const queue = useAppStore.getState().announcementQueue;
    if (queue.length === 0) return;

    const next = queue[0];
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
    current.forEach((ann) => {
      const config = typeConfig[ann.type];
      if (config.autoDismiss) {
        const timer = setTimeout(() => {
          dismissAnnouncement(ann.id);
        }, config.autoDismiss);
        return () => clearTimeout(timer);
      }
    });
  }, [current, dismissAnnouncement]);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {current.map((announcement) => {
          const config = typeConfig[announcement.type];
          const Icon = config.icon;

          return (
            <motion.div
              key={announcement.id}
              initial={{ opacity: 0, x: 300, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`${config.bg} text-white rounded-xl p-4 shadow-2xl pointer-events-auto`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-sm font-bold uppercase tracking-wide">
                    {announcement.title}
                  </h4>
                  <p className="text-sm mt-1 opacity-90 line-clamp-3">
                    {announcement.body}
                  </p>
                </div>
                <button
                  onClick={() => dismissAnnouncement(announcement.id)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
