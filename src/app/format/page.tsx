"use client";

import { Info } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { FormatGuide } from "@/components/format-guide";
import { soloEvents, teamEvents } from "@/lib/events";

export default function FormatPage() {
  return (
    <PageTransition>
      {/* Hero */}
      <div className="bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-4">
            <Info className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-white/80">
              Format &amp; FAQ
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">
            HOW IT WORKS
          </h1>
          <p className="mt-3 text-white/60 max-w-xl mx-auto">
            9 teams. {soloEvents.length} solo events, {teamEvents.length} team
            events. One champion. Here&apos;s how points are earned — please read
            this before game day.
          </p>
        </div>
      </div>

      <FormatGuide />
    </PageTransition>
  );
}
