/**
 * Seed Script for Casualympics™ Dashboard
 *
 * Populates the database with sample data for development/demo purposes.
 *
 * Usage:
 *   1. Set your NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   2. Run: npx tsx scripts/seed.ts
 *
 * WARNING: This uses the service role key (bypasses RLS). Never use in production.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("🏟️  Seeding Casualympics™ database...\n");

  // ─── 1. Create sample users ───────────────────────────────────────────
  console.log("👤 Creating sample users...");
  const userProfiles = [
    { display_name: "Alex Johnson", role: "admin" },
    { display_name: "Maria Garcia", role: "participant" },
    { display_name: "Sam Wilson", role: "participant" },
    { display_name: "Jessica Chen", role: "participant" },
    { display_name: "David Kim", role: "participant" },
    { display_name: "Emma Thompson", role: "participant" },
    { display_name: "Ryan Patel", role: "participant" },
    { display_name: "Olivia Brown", role: "participant" },
    { display_name: "Carlos Rivera", role: "participant" },
    { display_name: "Sofia Andersson", role: "participant" },
    { display_name: "Jake Murphy", role: "participant" },
    { display_name: "Lily Zhang", role: "participant" },
  ];

  // Create auth users and insert profiles
  const userIds: string[] = [];
  for (let i = 0; i < userProfiles.length; i++) {
    const email = `user${i + 1}@olympics.local`;
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.admin.createUser({
      email,
      password: "password123",
      email_confirm: true,
    });

    if (authErr) {
      // User might already exist
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email === email);
      if (existing) {
        userIds.push(existing.id);
        // Update profile
        await supabase
          .from("users")
          .upsert({
            id: existing.id,
            display_name: userProfiles[i].display_name,
            role: userProfiles[i].role,
          });
        console.log(`  ✓ ${userProfiles[i].display_name} (existing)`);
        continue;
      }
      console.error(`  ✗ Failed to create ${email}:`, authErr.message);
      continue;
    }

    if (user) {
      userIds.push(user.id);
      await supabase.from("users").upsert({
        id: user.id,
        display_name: userProfiles[i].display_name,
        role: userProfiles[i].role,
      });
      console.log(`  ✓ ${userProfiles[i].display_name}`);
    }
  }

  if (userIds.length < 4) {
    console.error("Not enough users created. Aborting.");
    process.exit(1);
  }

  // ─── 2. Create teams ─────────────────────────────────────────────────
  console.log("\n🏆 Creating teams...");
  const teamsData = [
    {
      name: "The Thunderbolts",
      color: "#E94560",
      motto: "Strike fast, strike hard!",
    },
    {
      name: "Ocean Waves",
      color: "#06B6D4",
      motto: "Flowing to victory",
    },
    {
      name: "Golden Eagles",
      color: "#F5A623",
      motto: "Soar above the rest",
    },
    {
      name: "Emerald Knights",
      color: "#22C55E",
      motto: "Honor. Strength. Victory.",
    },
  ];

  const teamIds: string[] = [];
  for (let i = 0; i < teamsData.length; i++) {
    const captainId = userIds[i * 3]; // Every 3rd user is captain
    const { data: team, error } = await supabase
      .from("teams")
      .insert({
        ...teamsData[i],
        captain_id: captainId,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  ✗ Failed to create ${teamsData[i].name}:`, error.message);
      continue;
    }

    teamIds.push(team.id);
    console.log(`  ✓ ${teamsData[i].name} (captain: ${userProfiles[i * 3].display_name})`);

    // Add team members (captain + 2 others)
    const members = [
      { team_id: team.id, user_id: captainId, role: "captain" },
    ];

    // Add 2 more members per team
    const memberStart = i * 3 + 1;
    for (let m = 0; m < 2 && memberStart + m < userIds.length; m++) {
      members.push({
        team_id: team.id,
        user_id: userIds[memberStart + m],
        role: "member",
      });
    }

    const { error: memberErr } = await supabase
      .from("team_members")
      .insert(members);
    if (memberErr) {
      console.error(`    Members error:`, memberErr.message);
    } else {
      console.log(`    Added ${members.length} members`);
    }
  }

  // ─── 3. Create events ────────────────────────────────────────────────
  console.log("\n📅 Creating events...");
  const eventsData = [
    {
      name: "Relay Race",
      description:
        "A classic sprint relay where teams of four compete head-to-head.",
      location: "Main Track",
      status: "completed",
      max_participants: 16,
      scheduled_at: "2025-07-15T09:00:00Z",
    },
    {
      name: "Tug of War",
      description:
        "A battle of raw strength. Two teams pull until one crosses the line.",
      location: "Central Field",
      status: "completed",
      max_participants: 20,
      scheduled_at: "2025-07-15T10:00:00Z",
    },
    {
      name: "Water Balloon Toss",
      description:
        "Partners toss a water balloon, stepping back each round.",
      location: "Pool Area",
      status: "completed",
      max_participants: 24,
      scheduled_at: "2025-07-15T11:00:00Z",
    },
    {
      name: "Sack Race",
      description: "Hop to the finish in a burlap sack!",
      location: "Main Track",
      status: "in_progress",
      max_participants: 16,
      scheduled_at: "2025-07-15T13:00:00Z",
    },
    {
      name: "Capture the Flag",
      description:
        "A strategic team battle to capture the opponent's flag.",
      location: "Woods Area",
      status: "upcoming",
      max_participants: 20,
      scheduled_at: "2025-07-15T14:30:00Z",
    },
    {
      name: "Trivia Bowl",
      description: "Rapid-fire general knowledge competition.",
      location: "Community Center",
      status: "upcoming",
      max_participants: 16,
      scheduled_at: "2025-07-15T16:00:00Z",
    },
    {
      name: "Obstacle Course",
      description:
        "Multi-stage challenge testing speed, strength, and grit.",
      location: "Adventure Park",
      status: "upcoming",
      max_participants: 12,
      scheduled_at: "2025-07-16T09:00:00Z",
    },
    {
      name: "Egg & Spoon Race",
      description:
        "Balance an egg on a spoon and race to the finish.",
      location: "Main Track",
      status: "upcoming",
      max_participants: 16,
      scheduled_at: "2025-07-16T10:30:00Z",
    },
  ];

  const eventIds: string[] = [];
  for (const event of eventsData) {
    const { data, error } = await supabase
      .from("events")
      .insert(event)
      .select("id")
      .single();

    if (error) {
      console.error(`  ✗ Failed to create ${event.name}:`, error.message);
      continue;
    }
    eventIds.push(data.id);
    console.log(`  ✓ ${event.name} (${event.status})`);
  }

  // ─── 4. Create scores (for completed events) ─────────────────────────
  console.log("\n📊 Creating scores...");
  const completedEvents = eventIds.slice(0, 3); // First 3 events are completed

  let scoreCount = 0;
  for (const eventId of completedEvents) {
    for (let t = 0; t < teamIds.length; t++) {
      // Each team member scores in the event
      const memberStart = t * 3;
      for (let m = 0; m < 3 && memberStart + m < userIds.length; m++) {
        const value = Math.floor(Math.random() * 60) + 40; // 40-100
        const { error } = await supabase.from("scores").insert({
          event_id: eventId,
          team_id: teamIds[t],
          user_id: userIds[memberStart + m],
          value,
          notes: value >= 80 ? "Outstanding performance!" : null,
        });
        if (!error) scoreCount++;
      }
    }
  }
  console.log(`  ✓ Created ${scoreCount} score entries`);

  // ─── 5. Create announcements ──────────────────────────────────────────
  console.log("\n📢 Creating announcements...");
  const announcementsData = [
    {
      title: "Welcome to the Casualympics™!",
      body: "We're thrilled to have everyone here. Check the schedule and get your team ready. Let the games begin! 🏟️",
      type: "general",
      author_id: userIds[0],
    },
    {
      title: "Relay Race Results Are In!",
      body: "Congratulations to all teams! The Relay Race has been completed. Check the leaderboard for the standings.",
      type: "score_update",
      author_id: userIds[0],
    },
    {
      title: "Sack Race Starting Now!",
      body: "All Sack Race participants, please head to the Main Track. The event starts in 5 minutes!",
      type: "event_starting",
      author_id: userIds[0],
    },
    {
      title: "Golden Eagles Take the Lead! 🦅",
      body: "After three events, the Golden Eagles have climbed to first place. Can anyone catch them?",
      type: "celebration",
      author_id: userIds[0],
    },
    {
      title: "Weather Advisory",
      body: "Light rain expected around 3pm. Outdoor events may be briefly delayed. Stay tuned for updates.",
      type: "urgent",
      author_id: userIds[0],
    },
  ];

  for (const ann of announcementsData) {
    const { error } = await supabase.from("announcements").insert(ann);
    if (error) {
      console.error(`  ✗ ${ann.title}:`, error.message);
    } else {
      console.log(`  ✓ ${ann.title}`);
    }
  }

  // ─── Done ─────────────────────────────────────────────────────────────
  console.log("\n✅ Seed complete!");
  console.log(`   ${userIds.length} users`);
  console.log(`   ${teamIds.length} teams`);
  console.log(`   ${eventIds.length} events`);
  console.log(`   ${scoreCount} scores`);
  console.log(`   ${announcementsData.length} announcements`);
  console.log("\n🔑 Login credentials:");
  console.log("   Email: user1@olympics.local (admin)");
  console.log("   Email: user2@olympics.local - user12@olympics.local (participants)");
  console.log("   Password: password123 (all accounts)");
}

seed().catch(console.error);
