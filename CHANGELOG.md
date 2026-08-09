# Changelog

All notable features and changes to the Casualympics™ Dashboard are documented here.

---

## v2.0 — The next one

### A new front door, on the opposite palette
- `/` is now the front door for the **next** Casualympics. The 2026 site hasn't gone anywhere — it moved one door down to **`/2026`** — and every other URL it had is exactly where it was: `/leaderboard`, `/teams`, `/rules`, `/format`, `/schedule`, `/venue`, `/admin`, `/dashboard`, the lot. Links people shared on the day still work
- **The palette is the 2026 palette inverted**, and inverted literally: every colour is the exact RGB complement (255 − channel) of the one it replaces. Near-white paper becomes near-black `void`, navy ink becomes `bone`, coral becomes a teal `signal`, gold becomes an electric-blue `beacon`. It's a rule rather than a mood, which is why the two sites can sit next to each other without looking like a theme toggle
- Inverting flips lightness along with hue, so the old *light* shades come back dark and the *dark* shades come back bright. They're renamed for what they now do (`signal-bright`, `signal-deep`) instead of where they came from
- These are **additional** tokens, not overrides. The 2026 site keeps asking for `bg-background` / `text-foreground` and renders exactly as it always did; nothing about the new palette can leak into it
- **The scrollbar follows the theme** — a teal thumb on a near-black track, the same design as the 2026 bar (accent thumb on the site's own chrome) with the palette swapped, instead of a coral stripe left over down the edge of a black page. Scoped in CSS with `:has` off a marker class on the layout, because the viewport's scrollbar belongs to `<html>` and can't be reached from a nested layout; the 2026 bar is untouched. Styled for both the standard `scrollbar-color` path and the older `-webkit-` one
- The two sites are **route groups** (`(v1)` and `(v2)`) with a layout each, so the chrome belongs to the site instead of to the document. The root layout is now just the `<html>` element, the fonts and the providers both sites share. Route groups don't appear in URLs — this is a structural change with no visible one

### The countdown is now a board that won't tell you
- The 2026 hero had a clock ticking down to a known date. The next event doesn't have a date yet, and the new home page is built around **not having one** rather than apologising for it
- A **split-flap board** — the mechanical clatter of an old departure board — shuffles continuously, settles for a couple of seconds on something unhelpful (`SOON`, `NOT YET`, `ANY DAY NOW`, `TBA`), and breaks up again. You can tell an event is coming. You can't tell when
- Underneath it, a second board is shaped **exactly like a date** — two digits, a three-letter month, a four-digit year — and is given no phrases at all, so it never settles on anything. It's the most specific-looking thing on the page and says the least
- Both boards are the same component: settling is just what a board does when you give it words, and the date board is the same machine handed an empty list
- Cells flip on their **own cadence**, so the board rattles unevenly the way a real one does instead of strobing in lockstep. The flip is CSS, replayed by the character changing, so nothing has to keep animation state in sync across a couple of dozen cells
- **It stops when nobody's looking** — a hidden tab doesn't clatter — and it holds completely still for anyone who's asked for reduced motion, showing a legible phrase rather than a frozen scramble. The flaps are hidden from screen readers, which get one plain sentence: the date hasn't been announced
- Server-rendered as a still frame of itself, so there's no hydration mismatch and no flash of nothing

### Getting back to 2026
- A **Still live** widget on the new home page opens the 2026 site — the home page itself plus a direct link to each of its pages, including both tournament boards
- Inside the 2026 site, the logo and the sign-out redirect now land on `/2026` rather than `/`, so clicking "home" doesn't quietly move you to a different site. Its footer carries a link the other way
- **The 2026 clock knows it's over.** It had exactly one state past zero — "game day is here" — which it would have gone on announcing forever. There's now an `archived` tier that takes over once game day has run out, retiring the clock and pointing at the final standings instead
- The countdown's arithmetic moved to `src/lib/countdown.ts` and is covered by tests, including the tier boundaries that used to be untested

---

## v1.22 — Hiding the leaderboard

### The playoff bracket can be redrawn on its own
- New **Reset bracket** button on the Playoff Bracket section of the Dodgeball and Tug of War admin screens. It deletes the semifinals, final and 3rd-place match and hands back the **Randomize seeding** button, so a bracket drawn too early — or drawn before a wildcard was corrected — is fixed by drawing it again
- **The group stage is untouched.** Until now the only way out of a wrong bracket was the full tournament reset, which throws away all nine group matches; this keeps the groups, the results and the qualifiers exactly as they stand. The old reset is still there for starting over, and is now labelled **Reset tournament** to tell the two apart
- Re-drawing pairs the **same four teams** differently. To change *who* is in the bracket, pick a different wildcard first — a 2nd-place tie stays editable above the bracket — then draw again
- Everything derived from the deleted matches unwinds with them: the **placement points** disappear along with the final and 3rd-place results, and the captains' **wagers** on those matches are refunded and voided, so nobody is left staked on a match that no longer exists. The confirm spells all of that out before anything is deleted
- The matches are deleted **before** the seeded flag drops, so a failure part-way can't leave an un-seeded tournament sitting on a live bracket that a second draw would duplicate. And a seeded flag with no bracket rows behind it is now read as un-seeded — the same repairable shape as the "groups locked but no matches" case — so it offers the draw again instead of rendering an empty bracket
- No schema change: `supabase/wagers.sql` already voids a match's wagers when the row is deleted

### Tug of War is drawn from the solo board
- The Tug of War groups are now seeded off the **solo leaderboard** rather than the team board. It's the first team event, so there is nothing else to seed on, and the solo results are what earned the seeding — the draw is a function of the solo scores alone, and nothing scored in a team event can move it
- Dodgeball is unchanged and still seeds off the **team** board. Which board a tournament draws from is now an explicit `seedFrom` setting rather than an assumption, and the seeding logic works off the minimum a board has to carry (`SeedStanding`), so both fit the same engine
- Tug of War takes the **settled** solo order, tiebreaks applied, so a played-off tie decides the draw the same way it decides the top-3 bonus
- **Locking now warns about half-scored solo events.** Locking is irreversible, so an event with results still to enter would quietly seed the wrong groups. The admin panel and the lock dialog both name the events that aren't fully scored, and the warning says what's at stake — for Tug of War the groups *are* the solo order, while for Dodgeball it's the top-3 bonus and the wildcard priority marker
- It stays a warning, never a block: a team that genuinely sat an event out would leave it listed as incomplete forever

### The attendance sweep now cuts both ways
- Being late or absent costs a team **−1 point** per player, down from −2
- New **full-team bonus**: a team whose players all made the cutoff earns **+1**. Awarded once to the team rather than per player, so a big roster isn't worth more than a small one — it's a flat reward for the same achievement
- The carrot and the stick are **one operation**: decided off the same cutoff, applied by the same button, and undone together by **Remove all**, so the two can't end up reflecting different ideas about who was on time
- Both passes are defined in terms of a single "on time" test, so they can never disagree about the same player — the bonus is exactly *"nobody on this team was charged"*, true by construction. An unreadable arrival stamp still counts as on time, failing in the player's favour
- A team that already had someone charged by an earlier sweep can't qualify for the bonus now just because that player is skipped this time round; re-running remains safe in both directions, and an empty team earns nothing
- The panel shows the two sides side by side with a running **net points** figure, and the confirm line spells out both before anything is written

### The standings can be taken off the public site
- New **Public leaderboard** switch on the admin dashboard. Hidden, `/leaderboard` shows a *"the leaderboard is hidden"* message in place of every tab, and the team pages drop their point totals — so the finish can be a reveal instead of a running commentary
- **Scoring is untouched.** Points keep being awarded, deducted, recomputed and audited exactly as before while the board is hidden; the switch only decides what the public pages render. The copy says so in both places, because "hidden" and "paused" are easy to confuse when someone else is working the score desk
- **Admins keep seeing the live board**, with a gold banner on every affected page saying the public can't. Without it, it's very easy to flip the switch, look at your own screen, see the standings and assume it didn't take
- Volunteers see the hidden version like everyone else. They record results all day, and a phone left open on the desk is exactly how a hidden board leaks back into the room
- The hide covers everywhere the standings surface, not just the leaderboard: the header stat strip (it gives away the running team-point total), the `X pts` on each card in **All Teams**, the total and per-player points on a **team's page**, and that page's whole **Scores** breakdown, which is the standings in longhand
- **All Teams** also falls back to **alphabetical order** while hidden — its cards are normally in leaderboard order, which hands over the ranking even with the numbers stripped off
- The Tug of War panel on All Teams is hidden along with them, matching the leaderboard's own Tug tab
- Flipping the switch reaches **every open page over realtime**, so the reveal lands on every phone in the room at once without anyone being told to refresh
- Pages hold their skeleton until both the data and the switch have resolved — rendering the board first and hiding it a moment later would flash exactly what the switch exists to hide
- If the settings row can't be read the board stays **visible**: a settings hiccup shouldn't take the leaderboard down mid-event

### Schema — one file to run, once
- **`supabase/app_settings.sql`** — a single-row `app_settings` table (`id` pinned to 1) for admin-controlled site switches, holding `leaderboard_hidden` plus who last changed it. Publicly readable, because every visitor's browser has to know whether the board is hidden before it can decide what to render; **admin-only** to write, so the timing of the reveal stays with the organiser
  - It's a presentation switch, **not** a security boundary. The underlying score rows stay publicly readable — the whole app is built on anonymous reads, and locking them down would also take them from the rules and schedule pages that legitimately use them — so someone querying the API directly could still add the points up themselves
  - Added to the realtime publication; every flip is written to the audit log

---

## v1.21 — Registration desk & point deductions

### The home page countdown gets louder as the day approaches
- The hero clock now **escalates in tiers** instead of looking identical a year out and an hour out. Over a week away it's the calm white clock it always was; inside a week it turns **gold** with a headline counting the days; inside 24 hours it turns **coral**, drops the empty Days slot and grows; inside the final hour it's just **minutes and seconds**, at the size the days used to be
- A glow behind the clock breathes in time with the tier — slow at a week, urgent in the last hour — and every digit **rolls up into place** as it changes, so the seconds visibly tick
- **Game day** replaces the clock with "GAME DAY IS HERE" at hero scale
- Fixed a flash of "Game Day is Here!" on first paint: the old clock seeded itself with the event time, so the server rendered a finished countdown for a moment on every visit no matter how far out it was. It now renders dashes until the first real tick
- Accessibility: the ticking digits are `aria-hidden` (a number that rewrites itself every second is unusable read aloud) with a plain "2 days until the Casualympics" behind them, and `prefers-reduced-motion` drops the rolling and the glow while keeping the colour and size changes, which carry the meaning

### Dodgeball eliminations are a group-stage point only
- Once Dodgeball reaches the **playoff bracket**, eliminations stop paying. The semis, final and 3rd-place match score on **round wins and final placement** alone, so a knockout game is won by winning the round rather than by running up the count in a game already decided
- The group stage is unchanged: 1 point per opponent eliminated, derived from the survivor counts as before. Tiebreaker games never paid eliminations and still don't
- The recorder follows the rule — the **Survivors** tally no longer appears on bracket matches, so nobody is counting a number that can't score. Survivor counts already saved against a bracket match are simply not scored
- Public copy updated to match: the leaderboard note, the Dodgeball scoring line in the format guide and rules, and the admin bracket header

### Volunteers can check people in as they arrive
- New **Check-In** tool at `/admin/check-in`, open to volunteers as well as admins — the first tool on the day, and the first card on the admin dashboard
- One tap per person: tap a name to mark them arrived, tap it again to undo. Rows are phone-sized targets, the arrival time is shown next to each checked-in name, and the whole list updates optimistically so a queue doesn't wait on the network
- Filter by **team** (colour chips, same control as the event picker) and by **status** (All / Waiting / Arrived), plus a name search. A sticky header keeps the search box, the filters and an **arrived / expected** progress meter in reach while the list scrolls — the meter follows the team filter but deliberately ignores the search box, so typing a name doesn't make progress jump around
- Each team section carries its own `arrived / total`, counted against the real roster rather than whatever the filters are currently showing
- Several volunteers work the door at once, so the page subscribes to `roster_checkins` over realtime — a name checked in on one phone greys out on the others instead of being tapped twice
- Crossed-out players are left off the list (nobody should be waiting on someone who was replaced) unless they've somehow been checked in, in which case they stay visible and undoable with a "crossed out" note
- Failed writes roll the row back and say so, rather than leaving a check mark the database never accepted; a check-in that can't be *read* is reported instead of rendering as an empty desk

### Point deductions
- **Totals can now go negative.** No schema change was needed — `roster_scores.points` was already a plain integer and the standings just sum it — but the deduction path around it is new, and the captain wager panel now clamps "points available to wager" at zero rather than showing a team in the red a negative allowance
- **Score Management** takes deductions directly: an explicit **Award / Deduct** toggle next to the points field, rather than relying on someone typing a minus sign. The field takes a magnitude and the toggle supplies the sign, so a mistyped `-` can't quietly turn a penalty into a reward; the button, the running preview and the entry in Recent Scores all turn red for a deduction
- Rejected writes on that form are now reported. They used to end in a silent `if (!error)` with the filled-in form still sitting there looking saved
- **One-click attendance sweep** on `/admin/check-in`: reads the list the desk has been tapping all morning and charges every player who was late or never turned up **−2 points to their team**. Late is measured against an editable cutoff (defaults to the 10:00 opening ceremony), so a day that starts behind schedule doesn't punish everyone
- The sweep writes one `roster_scores` row per player, so each charge is attributable, shows up on the team's page, and can be lifted individually in Score Management — or all at once with **Remove all**
- Re-running it is safe: rows are tagged `metadata.kind = "attendance_penalty"` and anyone already carrying one is skipped, so a second click can't double-charge. Crossed-out players are never charged — a team shouldn't pay for someone it already replaced
- The whole thing is **admin-only**. Volunteers work the door but don't decide what absence costs, so the panel is hidden from them (and from an admin using "view as volunteer")

### Admin dashboard
- Removed the **Wager History** card. The page itself is untouched and still works at `/admin/wagers`, it just isn't linked from the dashboard any more

### Schema — two files to run, once each
- **`supabase/checkins.sql`** — `roster_checkins` holds one row per player who has arrived (`player_id` PK, `checked_in_at`, `checked_in_by`). Presence *is* the state: no row means not here yet, so checking someone out is a delete and there's nothing to reconcile
  - Deliberately a separate table rather than a column on `roster_players`: RLS can't grant write access to individual columns, so a check-in column would have handed volunteers the whole roster. This table is the only thing they can write, and the roster itself stays admin-only
  - Unlike scores and rosters it is **not** publicly readable — who has and hasn't turned up is attendance data about named individuals, and nothing on the public site needs it. Reads and writes are both limited to admins and volunteers via the existing `is_event_recorder()` helper
- **`supabase/migrate_admin_only_deductions.sql`** — adds `public.is_admin()` and splits the blanket volunteer write policy on `roster_scores` into per-command policies gated on the sign: volunteers may only insert rows worth 0 or more, may not turn a row negative or edit one that is, and may not delete a negative row. So the admin-only rule holds at the database, not just at the route — a volunteer poking the API directly gets refused
  - Nothing legitimate is lost: team-event scores are all placements and tallies, so the recorder only ever writes positive rows, and the wager escrow's `-1` stakes go through `SECURITY DEFINER` functions that bypass RLS
- Both check-ins and penalty sweeps are written to the audit log, non-revertibly — they're a record of who worked the door and what it cost, and both are undoable in one click on the page itself

### Tests
- 15 new unit tests in `src/lib/checkin.test.ts` covering roster ordering, the crossed-out rules, each filter and the combination of them, and the per-team and overall tallies
- 17 new unit tests in `src/lib/penalties.test.ts` covering late vs absent classification, the cutoff boundary (arriving exactly on it counts as on time), re-run safety, crossed-out players, the summary totals, and the sign/validation rules for manual entries
- 2 new tests in `src/lib/tournamentPoints.test.ts` pinning the group-stage-only elimination rule across all three bracket stages
- Suite is now 192 tests

---

## v1.20 — Every team game on the leaderboard, Players board removed

### All four team games now have a leaderboard tab
- Added **Tail Grab** and **Relay** tabs to `/leaderboard`, so all four team games are on the board rather than only the two bracketed ones — the tab order now follows the order the games are played on the day: Teams · Solo · Events · Tug of War · Dodgeball · Tail Grab · Relay
- Both deep-link like the existing tabs: `?tab=tail-grab` and `?tab=conditioned-relay`
- Unlike Tug of War and Dodgeball there's no bracket to draw — each is a single recorded result per team — so the tabs show **how each total was made up**: Tail Grab breaks down by round (placement + tails, with round-2 tails shown at their doubled value), and the Relay shows each team's finishing time
- New `computeTeamEventStandings` (`src/lib/teamEvents.ts`) reads those results back out of the `roster_scores` rows the `/admin/team-events` recorder writes. Points come from the stored row rather than being recomputed, so a team-game board can never disagree with the team total the same row feeds; places are derived (fastest-first for the Relay, most points first for Tail Grab, ties sharing a place and the place below skipped)
- Board columns are generated from the event's own `teamScoring` config, so a change to the scoring rules reshapes the board without a per-event layout
- Added `TeamEventBoard` and a shared `TableCard`/`Th`/`TeamCell` module under `src/components/leaderboard/`, now used by both the solo per-event table and the new boards
- 5 new unit tests covering ranking, the per-component breakdown, tie handling, and the stored-points guarantee

### Players leaderboard removed
- Dropped the **Players** tab and the individual/MVP standings behind it — the Casualympics scores teams, and an individual board on the same page invited it to be read as a competing ranking
- Removed `computePlayerStandings` and `PlayerStanding` from `src/lib/roster.ts`, along with their tests
- Scores can still be attributed to a player in the admin recorders, and a team's page still shows its per-player breakdown (`playerPointsMap`) — attribution is now for the record only

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

## v1.16 — Color teams, runner logo & consolidated tournaments

### Teams by color
- Teams are now identified by **color** instead of number — the nine teams became Red, Green, Dark Blue, Light Blue, Yellow, Purple, Orange, Pink, and Grey, with each team's card, icon, and leaderboard avatar painted its own color
- Colors are assigned to the existing player groups in a random shuffle (`supabase/migrate_team_colors.sql`); the seed in `supabase/roster.sql` ships one fixed shuffle for fresh databases
- Added `src/lib/colors.ts` with the canonical color palette and a `readableTextColor` helper so team initials stay legible (dark text on light tiles like Yellow/Light Blue, white on dark ones) across the teams pages, leaderboard, and admin recorders

### Runner logo (brand mark)
- Replaced the Flame logo with a new **running-figure mark** (`RunnerMark`) in the navbar, footer, and the login/signup screens
- Swapped the site favicon from `favicon.ico` to a new `icon.svg`

### Tournaments moved into the Leaderboard
- Added **Tug of War** and **Dodgeball** tabs to `/leaderboard` (six-tab segmented nav), each showing its group stage and playoff bracket via a shared `BracketTab`
- The leaderboard now deep-links by tab — `?tab=tug`, `?tab=dodgeball`, etc. — reading the active tab from the URL on load
- The standalone `/tug-of-war` and `/dodgeball` pages now redirect to their leaderboard tabs, and the two links were removed from the navbar

### Schedule — live "happening now" marker
- Added a live status banner to `/schedule` that updates every minute and covers every point in the day: a pre-event countdown ("N days to go"), the current/next item during event day, gaps between items, after the last item, and an "all done" state once the games wrap

### Rules & event content
- **Conditional Relay:** the specific leg conditions are now kept secret until closer to the event — the game's rules page shows a "Leg Conditions" announcement placeholder instead, and the detailed conditions + condition-specific equipment were removed from the event data; relay wording was tightened (tag-based handoffs, clearer restart rule)
- Clarified team size to **6 players per team** (Tail Grab now references "Players 2 through 6")
- Rebuilt the **Tail Grab explainer animation** for six players per team
- Trimmed redundant helper text from the Rules index (card descriptions and the solo/team section blurbs)

### Loading states — skeletons everywhere
- Removed the `AnimatedLoader` (the aurora/light-sweep/bouncing-dots panel added in v1.15) and its CSS; the login/signup gates now fall back to `PageSkeleton`, and the admin dashboard, Activity Logs, and Player Management use `SkeletonList` — so every loading state is now a content skeleton

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
