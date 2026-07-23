# Changelog

All notable features and changes to the Casualympics™ Dashboard are documented here.

---

## Unreleased (working changes since v1.04)

### Signup
- Removed white border outline from the signup page card

### Rules Page
- Added detailed solo event rules: Standing Long Jump, 100m Sprint, Triple Jump, 200m Sprint, Shotput, Garbage Basketball
- Added detailed team event rules: 7-Legged Race, Tail Grab, Dodgeball, Tug of War, Conditional Relay
- Added "Conditions" section rendering for events with leg conditions (e.g., Conditional Relay)
- Renamed "Conditioned 75m Relay" to "Conditional Relay" with 5 leg conditions
- Made setup section conditional (hidden when empty)

### Schedule & Calendar
- Created `schedule_entries` database table with RLS policies (public read, admin write)
- Built interactive Google Calendar-style day view component (`schedule-calendar.tsx`)
  - Hour grid (7 AM – 8 PM) with half-hour lines
  - Color-coded blocks by category (ceremony, solo event, team event, break, general)
  - Overlap detection with side-by-side column layout
  - Click empty space to create new entry (snaps to 15-min intervals)
  - Click existing blocks to edit
  - Category legend bar
- Created schedule entry form side panel (`schedule-entry-form.tsx`)
  - Fields: title, start/end time, location, category, event link, description
- Built admin schedule management page (`/admin/schedule`)
  - Two-panel layout: calendar + slide-in form
  - Full CRUD with audit logging
- Built public schedule page (`/schedule`)
  - Timeline view with event-day "Now" indicator and past-event dimming
  - Calendar view (read-only) reusing the admin calendar component
  - Toggle between Timeline and Calendar views (default: Calendar)
  - Wider layout (max-w-7xl) for better calendar visibility
- Added Schedule link with Clock icon to public navbar
- Added real-time subscription for schedule updates via `realtime-provider.tsx`
- Fixed greyed-out schedule entries: dimming only activates on the actual event date (2026-08-08)

### Admin Dashboard
- Merged "Event Management" and "Day Schedule" into single "Schedule & Events" admin link
- Fixed audit log display: corrected column names (`entity_type`, `actor_id`), added actor display name join
- Enhanced activity log to show actor name, action type, entity type, and detail context

### Audit Logging
- Created shared `logAudit()` utility (`src/lib/audit.ts`)
- Added audit logging to all admin operations: announcements (create/delete), schedule entries (create/update/delete), scores (create/update/delete/bulk delete)

### Score Management
- Fixed scores not displaying: disambiguated Supabase FK joins (`scores` table has two FKs to `users`)
- Inline editing: click pencil icon to edit score value and notes in-place (Enter to save, Escape to cancel)
- CSV export: download filtered scores as CSV with proper quoting for fields containing commas
- Bulk CSV import: upload or paste CSV data, auto-detects header row, matches event/team/participant by name, reports per-row errors
- Delete individual scores and "Delete All" with confirmation dialog
- Sortable table columns: click headers to sort by Event, Team, Participant, Result, or Date
- Search: filter scores by participant name or team name in real time
- Pagination: 25 scores per page with full navigation (First/Prev/pages/Next/Last), removed 50-score limit
- Added Date column to scores table
- Score count indicator with filtered vs. total display

### Branding
- Renamed event from "Neighborhood Olympics" to "Casualympics™" across the entire codebase
- Two-tone logo treatment: "CASUAL" in white + "YMPICS" in coral, with gold superscript TM
- Updated branding in navbar, footer, home page hero, dashboard, admin dashboard
- Updated browser tab title and meta description
- Updated all 6 Supabase email templates (signup confirmation, invite, reset password, magic link, reauthentication, email change)
- Updated database schema comment and seed script

### Landing Page
- Redesigned landing page with a minimal, clean layout
  - Simplified hero: large two-tone title, event date badge, compact stat row, softer background blurs
  - Quick-links strip below hero with icon + label for Leaderboard, Teams, Schedule, Rules
  - Events section split into Solo and Team grids with compact event cards (icon, name, scoring type)
  - Streamlined CTA section with medal icon and concise copy
  - Removed features grid section in favor of direct navigation
  - Narrower max-width (max-w-5xl) for a more focused reading experience
- Added countdown timer targeting Aug 8, 2026 at 10 AM
  - `useCountdown` hook with interval-based updates
  - Shows days, hours, minutes, seconds with tabular-nums for stable widths
  - Displays "Game Day is Here!" message when countdown reaches zero
- Updated hero tagline to "Get your teams together. Let's have some fun."

### Leaderboard
- Converted from multi-page to single-page inline event view
  - Event buttons toggle selection to show scores inline
  - "Overall" link returns to main leaderboard view
  - Handles both solo and team scoring display

### Announcements
- Replaced persistent banner with subtle toast notifications
  - Bottom-right positioned, frosted glass styling
  - Fetches latest announcement on mount (late arrivals see it)
  - Real-time subscription for new announcements
  - SessionStorage tracking for dismissed announcements
  - Color accent line and type-colored icon

### User Activity Tracking
- Created `user_activity` database table with RLS policies
- Added `logActivity()` helper function in `src/lib/audit.ts`
- Tracks user actions: sign-in, team creation, team join, team leave
- Activity logged from login, team create, and team detail pages

### Admin Audit Log Page (`/admin/audit`)
- Two-tab interface: "Admin Actions" and "User Activity"
- Admin tab: filters by action type and actor, sort order toggle, paginated table (25/page)
- User tab: filters by action type and user, sort order toggle, paginated table
- Server-side filtering via Supabase `.eq()` queries with `.range()` pagination
- Reusable `Pagination` component
- Added "Activity Logs" link to admin dashboard with ScrollText icon

### Project
- Created `CHANGELOG.md` to track features added per commit

---

## v1.15 — Format & FAQ page, simpler home

### Format & FAQ (new page)
- New **`/format`** ("How It Works") page that explains the event to a first-time player: what you're competing for, how points are earned, and an FAQ
- **How points work:** solo events award placement points (7 / 5 / 3 / 2 / 1) on a separate solo leaderboard, and the top 3 solo teams each carry +1 point onto the main team board plus playoff priority; team events feed the team total directly (each event's own scoring shown — Tail Grab, Tug of War, Dodgeball, Conditional Relay, with the relay worth the most)
- Explains the two team-focused leaderboards (Teams / Solo), tie handling, elimination rules, and where to find scores/schedule/rules
- Clarified that solo points don't contribute to team points directly — only the top-3 solo bonus does
- Content is derived from the scoring engine (placement scales from the scoring helpers, per-event text from each event's config) so it can't drift out of sync
- Added a **Format** link to the navbar; the scoring/FAQ content lives in a shared `FormatGuide` component

### Admin dashboard
- Made the tool cards uniform in size (equal-height grid) so the Solo Events / Team Events boxes line up, and shortened the Team Events card description to a single line

### Home page
- Rebuilt as a simple landing that points to the Format page: hero with a **Read the Format** button, a prominent **"read the format before game day"** banner, and a closing **Know Before You Go** call-to-action — all linking to `/format`
- Kept the countdown, the quick-links strip, and the full list of solo + team events (each linking to its rules page)
- Removed the dashboard-focused calls-to-action from the home page

### Navbar
- Removed the public **Dashboard** link from the navbar (top nav and the account dropdown); **Admin Dashboard** stays for admins and volunteers

### Loading states
- Replaced the spinning circle loaders across all pages with **skeleton loaders** — a new `Skeleton` / `SkeletonList` / `PageSkeleton` set mirrors the page content while it loads (leaderboard, teams, and every admin tool, plus the global route-transition loader and the dashboard). Removed the old `Spinner`/`FullPageLoader`
- Replaced the remaining plain-text "Loading…" states with a new on-theme **animated loading panel** (`AnimatedLoader`): a flowing navy→coral→gold aurora with a light sweep, a pulsing flame badge, and bouncing dots — used on the login/signup gates, Player Management, Activity Logs, and the admin activity feed
- The animated loader is fully responsive (fills its container / the viewport) and respects `prefers-reduced-motion`
- The Button's inline spinner (an in-progress action indicator) is unchanged

---

## v1.14 — Revertible activity logs, log paging & volunteer role

### Volunteers (new role)
- Added a third user role, **volunteer**, between participant and admin. Volunteers can sign in but only reach three admin tools — **Solo Events**, **Tug of War**, and **Dodgeball** — so they can help run those live events without full admin access
- The admin dashboard shows volunteers only their permitted cards; the navbar exposes the Admin Dashboard link to volunteers as well
- Middleware bounces volunteers away from any other `/admin` page (scores, roster, schedule, players, logs) back to the admin landing
- **Any admin** can appoint/remove volunteers (and promote/demote admins) from the Player Management page via a per-user role selector; you can't change your own role there. Role changes are recorded in the audit log
- **Signup access code:** the signup form now assigns a role based on which code is entered — the admin code (`ADMIN_SIGNUP_CODE`) makes an admin, the volunteer code (`VOLUNTEER_SIGNUP_CODE`, defaulting to `bestvolunteerever`) makes a volunteer. Signup copy is no longer admin-specific
- **Landing:** volunteers are sent to `/admin` (their tools) after login and after profile setup, instead of `/dashboard`
- **Signup goes straight to the dashboard:** the signup form now collects first/last name up front and creates the account with its profile already complete, so it redirects immediately to the dashboard (admins → `/dashboard`, volunteers → `/admin`) instead of routing through the separate profile-setup step (which could stall/loop)
- **View as volunteer:** admins get a "View as volunteer" button on the admin dashboard that previews the reduced volunteer experience (only the three tool cards, no activity feed) with a sticky banner and an "Exit preview" button; while previewing, the admin is kept within the volunteer-accessible tools. The preview is client-only and resets on refresh
- Database: `users.role` CHECK now allows `volunteer`, and a new "Admins can update any profile" RLS policy lets admins change other users' roles (still gated by the existing `enforce_role_change` trigger) — run `supabase/migrate_volunteer_role.sql` once in Supabase (also folded into `supabase/schemas/02_users.sql`)

### Activity logs — revert
- Admin actions on the core data tables (roster players, scores, solo results, schedule entries) can now be **reverted** directly from the Activity Logs page: undo a create by deleting the row, restore a delete by re-inserting it, or roll an update back to its previous values
- Each admin action now records a snapshot (`table_name`, `row_id`, `before`, `after`) so the reversal is exact; a **Revert** button appears on eligible entries with a confirmation dialog describing what will happen
- Reverting marks the original entry as reverted (kept in the log, dimmed) and records the reversal itself as a separate `revert` entry for accountability
- Tournament/bracket actions (Tug of War, Dodgeball) are intentionally **not** revertible — undoing them would leave derived seeding/bracket state inconsistent
- Historical entries logged before this release have no snapshot and show as non-revertible

### Activity logs — paging & filters
- Added a **per-page selector** (5 / 20 / 50, default 20) shared across both the Admin Actions and User Activity tabs
- (Filtering by the user/admin who performed an action already existed via the actor dropdown on each tab)

### Database
- `audit_log` gains `table_name`, `row_id`, `before`, `after`, `reverted_at`, `reverted_by` columns plus an owner-only UPDATE policy — run `supabase/migrate_audit_revert.sql` once in Supabase (also folded into `supabase/schemas/07_audit.sql`)

### Navbar & mobile
- Slightly tightened desktop nav link spacing so the links fit better before the mobile breakpoint
- Eliminated mobile horizontal scroll: added a page-level `overflow-x: clip` (sticky-safe, unlike `hidden`) on `html`/`body`, which also contains the off-canvas mobile sidebar that sits translated off the right edge while closed. Wide tables and the event tabs keep their own opt-in `overflow-x-auto`

### Team-event results recorder (new feature)
- New **Team Events** hub on the admin dashboard (replacing the separate Tug of War / Dodgeball cards): admin dashboard → Team Events → the four team games, each on its own page
- **Tail Grab** and **Conditional Relay** get a built-in results recorder (mirroring the Solo Events flow); **Tug of War** and **Dodgeball** link out to their existing tournament tools
- **Tail Grab recorder:** per team, enter Round 1 and Round 2 separately (placement + tails grabbed per round). Points are computed automatically (placement points + tails, round-2 tails worth ×2) with a live per-round subtotal
- **Conditional Relay recorder:** enter each team's final time; the app ranks teams fastest-to-slowest and awards placement points (15/12/10/8/6/5/3/2/1) with standard-competition tie handling, re-ranking the whole field whenever a time changes
- Computed results are written as ordinary `roster_scores` rows, so they flow into the leaderboard exactly like manually-entered points — **Score Management is unchanged** and still available for ad-hoc awards
- Volunteers can use the recorder/hub (added to the volunteer-accessible admin paths)
- Added a generic `group` field to team scoring components (drives the Round 1 / Round 2 sections) and a `computeRelayStandings` helper, both unit-tested (6 new tests, 74 total)
- Database: `roster_scores` gains a `metadata` JSONB column that stores the raw inputs behind each computed total so results can be reopened and edited — run `supabase/migrate_roster_scores_metadata.sql` once in Supabase (also folded into `supabase/roster.sql`)

### Player Management — account removal
- Any account can now be **removed** from Player Management (admins included) except your own, which would lock you out
- Removal runs server-side via the service role (`/api/admin/delete-user`): it deletes both the login (`auth.users`) and the profile, cleaning up foreign-key references safely — authored content (events, schedule, teams, announcements) is reassigned to the acting admin rather than cascade-deleted
- The player list was rebuilt as a responsive card layout (no horizontal scroll)

### Activity logs — preserve deleted accounts
- A removed account's history is now **kept and stays readable**: `audit_log.actor_id` and `user_activity.user_id` switch to `ON DELETE SET NULL`, and each row snapshots the actor/user display name at write time (via triggers), so entries show the original name marked "(removed)" instead of "Unknown"
- The Activity Logs tables were rebuilt as responsive card lists (no horizontal scroll)
- Database — run `supabase/migrate_preserve_deleted_actor_trail.sql` once in Supabase (also folded into `supabase/schemas/07_audit.sql`)

### Signup
- Profile-setup sample name now reads "Michael Kwon"

---

## v1.13 — Solo events, scoring test suite & CI

### Solo events (new feature)
- Standalone solo-event scoring universe: each of the nine roster teams enters exactly one participant per solo event, recorded as a single raw result per team per event
- Admins record the raw measurement (time / distance / points) per team; the app ranks the teams within each event and awards placement points (1st=7, 2nd=5, 3rd=3, 4th=2, 5th=1, else 0), with standard-competition tie handling (tied teams share the higher place and the next place is skipped)
- Solo points accumulate into a **separate** solo team leaderboard and never mix into the team-event totals — the only crossover is that the top 3 solo teams each earn a +1 team-event point and a wildcard "priority" marker
- New scoring/data helpers in `src/lib/solo.ts`: `fetchSoloResults`, `computeEventStandings` (per-event ranking + ties), `computeSoloTeamStandings` (rollup + top-3 flag), `soloBonusByTeam`, and `soloPriorityTeamIds`

### Leaderboard
- Rebuilt with four tabs — Teams, Solo, Individual Events, Players
- Team standings now fold in the +1 solo bonus (surfaced as a badge on the team row)
- Individual Events tab: pick a solo event to see the per-team placement table with results formatted in the event's unit
- Replaced the horizontally-scrolling tab bar with a non-scrolling responsive segmented control (2×2 on mobile, 4-across on desktop); trimmed the tab labels and let the event-selector chips wrap instead of scroll

### Tournament engine
- `computeQualifiers` now accepts the solo top-3 "priority" set: when the 2nd-place teams tie for the wildcard, a single priority-marked team advances automatically; if none or several share priority the tie stays manual

### Admin
- New admin page `/admin/solo` to record, edit, and delete solo results per team per event, with live per-event standings and audit logging
- Added a "Solo Events" card to the admin dashboard

### Testing & CI
- Added Vitest with 68 unit tests over the scoring functions: `events` (input parsing/formatting round-trips, placement tables, component math), `solo` (ranking direction, ties, top-3 bonus), `roster` (team/player totals + bonus), and `tournament` (seeding, group standings, wildcard resolution)
- Shared test factories in `src/lib/test-fixtures.ts`; added `npm test` and `npm run test:watch` scripts
- New GitHub Actions workflow (`.github/workflows/ci.yml`): typecheck + tests on every push/PR to `main`; lint runs non-blocking for now (pre-existing lint debt)

### UX
- Added route-loading and session scaffolding: `loading.tsx`, a top navigation-progress bar (`navigation-progress.tsx`), an `auth-provider`, and a shared `spinner` component

### Database
- New schema file: `supabase/solo_events.sql` — `solo_results` table (one result per team per event, `UNIQUE (event_slug, team_id)`) with public-read/admin-write RLS (run once in Supabase)

---

## v1.12 — Dodgeball tournament

### Dodgeball (new feature)
- New standalone tournament layered on the roster teams, run after Tug of War, mirroring its group-stage → randomized playoff-bracket format (display/tracking only; placement points still awarded through the normal score tools)
- Groups snapshot the current overall team standings at lock time (which already include Tug of War points) and split them with a **snake seeding**: rank {1,6,7} → A, {2,5,8} → B, {3,4,9} → C
- Group stage is a round robin (best-of-3, round wins tracked); the three group winners plus the best 2nd-place team (with manual tiebreaker) advance to a randomized 4-team bracket (semifinals → final + 3rd-place match)

### Shared tournament engine
- Extracted the group-stage/bracket logic shared by Tug of War and Dodgeball into `src/lib/tournament.ts` (parameterized by table names + a group-seeding function; provides `assignGroupsInterleaved` and `assignGroupsSnake`)
- `src/lib/tug.ts` is now a thin config wrapper over the engine; `src/lib/dodgeball.ts` added alongside it
- Shared read-only display components `src/components/tournament/tournament-groups.tsx` and `tournament-bracket.tsx`; the existing `tug-groups`/`tug-bracket` are now thin wrappers over them

### Admin & Public
- New admin page `/admin/dodgeball` with the same 3-step flow as Tug of War (lock groups → record round wins → resolve wildcard & seed/record the bracket), plus "Reset tournament" and audit logging
- Added a "Dodgeball" card to the admin dashboard
- New public page `/dodgeball` (with a pre-lock "not started yet" state) and a "Dodgeball" link with a ball icon in the public navbar

### Database
- New schema file: `supabase/dodgeball.sql` — `dodgeball_state`, `dodgeball_group_members`, `dodgeball_matches` with public-read/admin-write RLS (run once in Supabase)

---

## v1.11 — Owner-only activity logs & announcements removal

### Activity Logs (owner-only)
- Restricted the activity/audit logs to a single owner account (`kwon.mike90@gmail.com`); other admins can no longer see them
- Enforced at every layer: middleware redirect for `/admin/audit`, a client-side guard on the page, the hidden "Activity Logs" link and "Recent Activity" feed on the admin dashboard, and tightened RLS so only the owner can `SELECT`/`DELETE` from `audit_log` and `user_activity` (any admin may still generate entries)
- Added `AUDIT_LOG_EMAIL` / `canViewAuditLog()` helper in `src/lib/auth.ts`

### Announcements (removed)
- Removed announcement creation and all related UI: deleted the `/admin/announcements` composer and the toast overlay
- Unwired the announcements realtime subscription, the Zustand store state, and the announcement sections on the admin and user dashboards
- Removed the `Announcement`/`AnnouncementType`/`AnnouncementRead` types and the dead `announcement_reads` cleanup on player deletion
- The `announcements`/`announcement_reads` tables are left intact (no data dropped)

### Player Management
- Removed the "assign team" feature from `/admin/players` (assign/change/remove plus the Team column) — a vestige of the pre-roster auth-team model; the page now lists players and handles account removal only

### Database
- Updated audit-log RLS policies in `supabase/schema.sql` and `supabase/schemas/07_audit.sql`
- New migration: `supabase/migrate_restrict_audit_to_owner.sql` (run once in Supabase)

---

## v1.10 — Tug of War tournament

### Tug of War (new feature)
- New standalone tournament layered on the roster teams: group stage → randomized playoff bracket, tracked and displayed in-app (final placement points 5/3/2/1 are still awarded through the normal score tools)
- New database tables with public-read/admin-write RLS (`supabase/tug_of_war.sql`):
  - `tug_state` — single-row tournament state (`groups_locked`, `bracket_seeded`, admin-set `wildcard_team_id`)
  - `tug_group_members` — team → group (A/B/C) + snapshotted solo-standings seed
  - `tug_matches` — group round-robin and bracket matches with round-win scores and winner
- Group assignment snapshots the solo standings at lock time and splits teams by rank: {1,4,7} → A, {2,5,8} → B, {3,6,9} → C
- Group stage is a round robin (best-of-3 matches); standings rank by total round wins, then seed
- Qualifiers: each group winner plus the best of the three 2nd-place teams (by round wins); a 2nd-place tie is flagged for a manual tiebreaker
- Bracket: "Randomize seeding" shuffles the four qualifiers into two semifinals; the final and 3rd-place match auto-populate from the semifinal winners/losers

### Admin
- New admin page `/admin/tug-of-war` with a 3-step flow: lock standings & generate groups → record group round wins → resolve wildcard ties and seed/record the bracket
- "Reset tournament" clears all groups, matches, and bracket results to regenerate
- Added a "Tug of War" card to the admin dashboard and audit logging for lock/reset/seed/match/wildcard actions

### Public
- New public page `/tug-of-war` showing the group standings and playoff bracket (with a pre-lock "not started yet" state)
- Added a "Tug of War" link with Swords icon to the public navbar
- Teams page: per-team "Group A/B/C" badges plus a collapsible embedded Tug of War section (groups + bracket) once groups are locked
- New shared display components `src/components/tug/tug-groups.tsx` and `tug-bracket.tsx`

### Database
- New schema file: `supabase/tug_of_war.sql` (run once in Supabase)

---

## v1.09 — Roster teams & manual scoring overhaul

### Roster system (auth-free teams)
- Replaced the account-based team system with a plain-data roster model: teams and players are managed by admins as simple rows, no longer tied to participant auth accounts
- New tables with public-read/admin-write RLS (`supabase/roster.sql`): `roster_teams`, `roster_players`, and `roster_scores` (team- or player-level manual point entries), seeded with the nine teams and their players
- New shared data/aggregation helpers (`src/lib/roster.ts`): `fetchRosterData`, `computeTeamStandings` (team totals + ranking), `computePlayerStandings` (MVP leaderboard), and `playerPointsMap`
- Removed the old auth-based team flows: deleted `/teams/create`, `/admin/teams`, and the per-event `/leaderboard/[eventId]` page
- Rebuilt the public Teams page and team profile page around the roster model (members, per-player points, team scores)
- Rebuilt the Leaderboard around roster team standings plus an individual/MVP view
- Rebuilt Score Management (`/admin/scores`) to award team- and player-level points on the roster model
- New Team Management page (`/admin/roster`): move players between teams, cross out / restore, rename, add, and remove players — all with audit logging
- Removed "Create a Team" links from the footer and dashboard; dropped `/teams/create` from middleware protected/admin paths

### Event Rules
- Tightened solo event rules (Standing Long Jump, 100m/200m Sprint, Triple Jump, Shot Put): two-footed take-off, perpendicular measurement, individually timed runs started on the starter's visual arm-drop, torso-crossing finish definition, and one-handed shot put
- Added a Tail Grab animation component (`src/components/rules/tail-grab-animation.tsx`) used on the event rules page

### Database
- New schema file: `supabase/roster.sql` (run once in Supabase)

---

## v1.08 — Admin-only access, schedule sections & audit log clearing

### Authentication & Access
- Restricted sign-in to admin accounts only — non-admins can hold an account but cannot sign in
- New code-gated sign-up: `/signup` now takes a shared access code (`ADMIN_SIGNUP_CODE`) + email + password and creates an admin account directly via a server-side route using the Supabase service-role key — no schema edits needed to onboard an admin
- Replaced the email-OTP and Google OAuth sign-up/sign-in flows with email + password
- Enforced the admin gate in middleware, the login page, and the OAuth callback (account setup/recovery links stay reachable)
- Added a role-escalation guard trigger so a user cannot change their own role (only admins / the service role can)

### Schedule
- Added `section`, `section_note`, and `lead` columns to schedule entries
- Public schedule timeline now groups entries into phase sections (Pre-Event, Solo Events, Lunch, Team Events, Wrap-Up) with an auto-computed time range, optional section note, and a Lead per entry; default view switched to the grouped timeline
- Admin schedule form gained Section, Section Note, and Lead fields
- Seeded the full event-day schedule (`supabase/seed_schedule.sql`)

### Audit Log
- Added a "Clear log" action with confirmation modal on the activity logs page — clears the admin audit log or user activity log for the active tab, and records the clear itself for accountability
- Added admin DELETE RLS policies for `audit_log` and `user_activity`

### Database
- New one-time migration scripts: `migrate_remove_organizer.sql`, `migrate_clear_logs.sql`, `seed_schedule.sql`

---

## v1.07 — Scoring system & event updates

### Event Rules
- Updated Standing Long Jump fault note (starting on the line counts as an attempt)
- Rewrote Conditional Relay: 35m legs with 3 lanes and new leg conditions (three-legged, blindfold feed, cardboard walking, target toss, camping chair carry); refreshed equipment
- Removed the 7-Legged Race event entirely
- Added `scoring` summaries to team events, now surfaced on the rules detail page

### Solo Event Scoring
- Solo events now award per-individual placement points (1st=7, 2nd=5, 3rd=3, 4th=2, 5th=1, else 0); each participant's points contribute to their team total
- Individual results table shows each participant's own point contribution

### Team Event Scoring
- Added configurable team scoring in `events.ts` (`TeamScoringConfig`): `rank-by-time` and component-based (`placement` + `tally`) methods
- Conditional Relay is now timed — the dashboard ranks teams by time and awards placement points (15/12/10/8/6/5/3/2/1); added a team standings table ranked by time on the leaderboard
- Tug of War, Dodgeball, and Tail Grab use placement + tally entry (round wins, eliminations, tails); admin score form computes the total live from entered components
- Overall standings aggregate solo, relay, and tournament points correctly

### Cleanup
- Resolved pre-existing lint debt in touched files: hoisted `SortIcon` out of render, typed several `any` casts, removed an unused import

---

## v1.04 — `6a207da`
- Updated admin score recording privileges
- Admin score input work-in-progress

## v1.03 — `d959116`
- Fixed bug where a user could create a team when already on a team
- Prevented non-authenticated users from creating a team

## v1.02 — `dc9afe1`
- Added player management feature for admin users
- Added Supabase hydration ignore configuration
- Admin score input work-in-progress

## v1.01 — `7d8f959`
- Updated rules page layout
- Created custom HTML email link templates for user invitations

## v1.0 — `999dda2`
- Added authentication system (sign up, sign in, sign out)
- Added update/reset password configuration

## Initial Commit — `625489b`
- Project scaffolding: Next.js App Router, Supabase, Tailwind CSS, TypeScript
- Base layout, theming, and UI component library
- Team creation and management
- Leaderboard page
- Rules page structure
- Admin dashboard shell
