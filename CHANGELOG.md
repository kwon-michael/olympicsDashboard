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

### Project
- Created `CHANGELOG.md` to track features added per commit

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
