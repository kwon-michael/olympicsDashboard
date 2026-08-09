"use client";

import { TournamentAdmin } from "@/components/admin/tournament-admin";

// Dodgeball and Tug of War run the identical group-stage-into-bracket format, so
// they share one screen (src/components/admin/tournament-admin.tsx). Everything
// specific to Dodgeball — snake seeding, the accent colour, the elimination
// tally — lives in that component's config.
export default function AdminDodgeballPage() {
  return <TournamentAdmin id="dodgeball" />;
}
