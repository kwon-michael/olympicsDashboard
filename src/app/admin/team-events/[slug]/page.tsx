"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { recorderTeamEvents } from "@/lib/teamEvents";
import { TeamEventRecorder } from "../TeamEventRecorder";

export default function TeamEventRecorderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const isValid = recorderTeamEvents.some((e) => e.slug === slug);

  if (!isValid) {
    return (
      <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin/team-events"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Team Events
        </Link>
        <p className="text-sm text-muted">That team event isn&apos;t recorded here.</p>
      </PageTransition>
    );
  }

  return <TeamEventRecorder slug={slug} />;
}
