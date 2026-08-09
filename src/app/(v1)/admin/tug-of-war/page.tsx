"use client";

import { TournamentAdmin } from "@/components/admin/tournament-admin";

// Shares one screen with Dodgeball — see
// src/components/admin/tournament-admin.tsx, where the Tug of War config sets
// the interleaved seeding and drops the elimination tally.
export default function AdminTugPage() {
  return <TournamentAdmin id="tug" />;
}
