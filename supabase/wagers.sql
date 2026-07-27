-- ============================================
-- Captain playoff wagers
-- ============================================
-- Lets a team captain stake exactly one of their team's points on the result of
-- a Tug of War / Dodgeball *playoff* match (stage semi/final/third). A captain
-- is a user linked to one roster player via roster_players.captain_user_id —
-- that link, not users.role, is what makes someone a captain, so an admin can be
-- one too. The team whose points they stake is that player's team.
--
-- Economy (escrow model, all expressed as roster_scores rows so the wager moves
-- the real team standings):
--   * Placing a bet inserts a -1 "staked" roster_score (escrow). A team must
--     hold >= 1 point to bet, and only one bet per team per match is allowed.
--   * When the match winner is recorded, a trigger settles every bet on it:
--       - correct pick  -> +2 "won" roster_score  (net +1 vs the -1 escrow)
--       - wrong pick     -> nothing more           (net -1: the point is forfeit)
--   * Corrections are safe: changing/clearing a winner reverses prior payouts and
--     re-settles. Deleting a match (bracket reset) refunds pending/settled bets
--     and marks them void.
--
-- Captains never write these tables directly — placement goes through the
-- SECURITY DEFINER place_wager() RPC and settlement through triggers, so the
-- admin-only RLS on roster_scores stays intact.
--
-- Safe to run more than once: IF NOT EXISTS / CREATE OR REPLACE / DROP..IF EXISTS
-- throughout.
-- ============================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Captain role
-- ----------------------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('participant', 'volunteer', 'admin', 'captain'));

-- ----------------------------------------------------------------------------
-- 2. Link a captain account to exactly one roster player
-- ----------------------------------------------------------------------------
-- A captain is a user account tied to a specific person on a roster (a
-- roster_players row). The team whose points they wager is that player's team.
-- Being linked here — not the `role` value — is what makes someone a captain, so
-- a user can be an admin AND a captain at the same time.
ALTER TABLE public.roster_players
  ADD COLUMN IF NOT EXISTS captain_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- A user captains at most one player, and a player has at most one captain.
CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_players_captain_user
  ON public.roster_players(captain_user_id) WHERE captain_user_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. Wagers table
-- ----------------------------------------------------------------------------
-- match_id references either tug_matches or dodgeball_matches depending on
-- `tournament`; it can't be a single FK, so integrity is enforced by the RPC
-- (match must exist at placement) and the match-delete trigger (void on delete).
CREATE TABLE IF NOT EXISTS public.wagers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- captain_id goes NULL if the account is removed; captain_name snapshots the
  -- display name so the admin history stays readable.
  captain_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  captain_name TEXT,
  team_id UUID NOT NULL REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  tournament TEXT NOT NULL CHECK (tournament IN ('tug', 'dodgeball')),
  match_id UUID NOT NULL,
  picked_team_id UUID NOT NULL REFERENCES public.roster_teams(id) ON DELETE CASCADE,
  stake INT NOT NULL DEFAULT 1 CHECK (stake = 1),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'won', 'lost', 'void')),
  -- Net change to the team's total attributable to this bet once resolved:
  -- 0 pending, +1 won, -1 lost, 0 void (refunded).
  net_points INT NOT NULL DEFAULT 0,
  stake_score_id UUID REFERENCES public.roster_scores(id) ON DELETE SET NULL,
  payout_score_id UUID REFERENCES public.roster_scores(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One bet per team per match.
  UNIQUE (team_id, tournament, match_id)
);

CREATE INDEX IF NOT EXISTS idx_wagers_match ON public.wagers(tournament, match_id);
CREATE INDEX IF NOT EXISTS idx_wagers_team ON public.wagers(team_id);

ALTER TABLE public.wagers ENABLE ROW LEVEL SECURITY;

-- Read: the owning team's captain, plus any admin. No direct write policies —
-- placement/settlement run through SECURITY DEFINER routines only.
DROP POLICY IF EXISTS "Wagers visible to owning captain and admins" ON public.wagers;
CREATE POLICY "Wagers visible to owning captain and admins" ON public.wagers
  FOR SELECT USING (
    captain_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 4. place_wager() — captain-facing RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_wager(
  p_tournament TEXT,
  p_match_id UUID,
  p_picked_team_id UUID
) RETURNS public.wagers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_name       TEXT;
  v_team_id    UUID;
  v_total      INT;
  v_stage      TEXT;
  v_team_a     UUID;
  v_team_b     UUID;
  v_winner     UUID;
  v_score_id   UUID;
  v_wager      public.wagers;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place a wager.';
  END IF;

  SELECT display_name INTO v_name FROM public.users WHERE id = v_uid;

  -- Captain-ness = being linked to a roster player. The team is that player's
  -- team. Authorization is the link itself, so an admin who is also a captain
  -- can bet too.
  SELECT team_id INTO v_team_id
  FROM public.roster_players WHERE captain_user_id = v_uid;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'You are not assigned as a team captain yet.';
  END IF;

  IF p_tournament NOT IN ('tug', 'dodgeball') THEN
    RAISE EXCEPTION 'Unknown tournament.';
  END IF;

  -- Pull the match from the matching table.
  IF p_tournament = 'tug' THEN
    SELECT stage, team_a, team_b, winner_id
      INTO v_stage, v_team_a, v_team_b, v_winner
      FROM public.tug_matches WHERE id = p_match_id;
  ELSE
    SELECT stage, team_a, team_b, winner_id
      INTO v_stage, v_team_a, v_team_b, v_winner
      FROM public.dodgeball_matches WHERE id = p_match_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That match no longer exists.';
  END IF;
  IF v_stage NOT IN ('semi', 'final', 'third') THEN
    RAISE EXCEPTION 'Wagers are only allowed on playoff matches.';
  END IF;
  IF v_team_a IS NULL OR v_team_b IS NULL THEN
    RAISE EXCEPTION 'That match is not set yet — try again once both teams are in.';
  END IF;
  IF v_winner IS NOT NULL THEN
    RAISE EXCEPTION 'That match is already decided.';
  END IF;
  IF p_picked_team_id NOT IN (v_team_a, v_team_b) THEN
    RAISE EXCEPTION 'Pick one of the two teams playing the match.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.wagers
    WHERE team_id = v_team_id AND tournament = p_tournament AND match_id = p_match_id
      AND status <> 'void'
  ) THEN
    RAISE EXCEPTION 'Your team has already wagered on this match.';
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_total
  FROM public.roster_scores WHERE team_id = v_team_id;
  IF v_total < 1 THEN
    RAISE EXCEPTION 'Your team has no points available to wager.';
  END IF;

  -- Escrow the staked point.
  INSERT INTO public.roster_scores (team_id, label, points, created_by, metadata)
  VALUES (
    v_team_id, 'Playoff wager — staked', -1, v_uid,
    jsonb_build_object('kind', 'wager', 'tournament', p_tournament,
                       'match_id', p_match_id, 'phase', 'stake')
  )
  RETURNING id INTO v_score_id;

  INSERT INTO public.wagers (
    captain_id, captain_name, team_id, tournament, match_id,
    picked_team_id, stake_score_id
  )
  VALUES (
    v_uid, v_name, v_team_id, p_tournament, p_match_id,
    p_picked_team_id, v_score_id
  )
  RETURNING * INTO v_wager;

  RETURN v_wager;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_wager(TEXT, UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Settlement + void
-- ----------------------------------------------------------------------------
-- Settle every wager on a match against `p_winner`. Reverses any prior
-- settlement first so winner corrections / re-openings stay consistent.
CREATE OR REPLACE FUNCTION public.settle_wagers(
  p_tournament TEXT,
  p_match_id UUID,
  p_winner UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w      public.wagers;
  v_pid  UUID;
BEGIN
  FOR w IN
    SELECT * FROM public.wagers
    WHERE tournament = p_tournament AND match_id = p_match_id AND status <> 'void'
  LOOP
    -- Undo a previous payout (won) before re-evaluating.
    IF w.status <> 'pending' THEN
      IF w.payout_score_id IS NOT NULL THEN
        DELETE FROM public.roster_scores WHERE id = w.payout_score_id;
      END IF;
      UPDATE public.wagers
        SET status = 'pending', net_points = 0, payout_score_id = NULL, settled_at = NULL
        WHERE id = w.id;
    END IF;

    IF p_winner IS NULL THEN
      CONTINUE; -- match re-opened; leave the bet pending (stake stays escrowed)
    END IF;

    IF w.picked_team_id = p_winner THEN
      -- Won: hand back the staked point plus one more (+2 vs the -1 escrow).
      INSERT INTO public.roster_scores (team_id, label, points, created_by, metadata)
      VALUES (
        w.team_id, 'Playoff wager — won', 2, w.captain_id,
        jsonb_build_object('kind', 'wager', 'tournament', p_tournament,
                           'match_id', p_match_id, 'phase', 'payout')
      )
      RETURNING id INTO v_pid;
      UPDATE public.wagers
        SET status = 'won', net_points = 1, payout_score_id = v_pid, settled_at = NOW()
        WHERE id = w.id;
    ELSE
      -- Lost: the escrowed point is forfeit; no payout row.
      UPDATE public.wagers
        SET status = 'lost', net_points = -1, settled_at = NOW()
        WHERE id = w.id;
    END IF;
  END LOOP;
END;
$$;

-- Refund + void every non-void wager on a match (used when a match row is
-- deleted, e.g. a bracket reset). Removes both the stake and any payout so the
-- team ends up whole.
CREATE OR REPLACE FUNCTION public.void_wagers(
  p_tournament TEXT,
  p_match_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.wagers;
BEGIN
  FOR w IN
    SELECT * FROM public.wagers
    WHERE tournament = p_tournament AND match_id = p_match_id AND status <> 'void'
  LOOP
    IF w.payout_score_id IS NOT NULL THEN
      DELETE FROM public.roster_scores WHERE id = w.payout_score_id;
    END IF;
    IF w.stake_score_id IS NOT NULL THEN
      DELETE FROM public.roster_scores WHERE id = w.stake_score_id;
    END IF;
    UPDATE public.wagers
      SET status = 'void', net_points = 0, stake_score_id = NULL,
          payout_score_id = NULL, settled_at = NOW()
      WHERE id = w.id;
  END LOOP;
END;
$$;

-- Per-tournament trigger wrappers.
CREATE OR REPLACE FUNCTION public.trg_tug_settle_wagers() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.winner_id IS DISTINCT FROM OLD.winner_id THEN
    PERFORM public.settle_wagers('tug', NEW.id, NEW.winner_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_dodgeball_settle_wagers() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.winner_id IS DISTINCT FROM OLD.winner_id THEN
    PERFORM public.settle_wagers('dodgeball', NEW.id, NEW.winner_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_tug_void_wagers() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.void_wagers('tug', OLD.id);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_dodgeball_void_wagers() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.void_wagers('dodgeball', OLD.id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tug_matches_settle_wagers ON public.tug_matches;
CREATE TRIGGER tug_matches_settle_wagers
  AFTER UPDATE OF winner_id ON public.tug_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_tug_settle_wagers();

DROP TRIGGER IF EXISTS dodgeball_matches_settle_wagers ON public.dodgeball_matches;
CREATE TRIGGER dodgeball_matches_settle_wagers
  AFTER UPDATE OF winner_id ON public.dodgeball_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_dodgeball_settle_wagers();

DROP TRIGGER IF EXISTS tug_matches_void_wagers ON public.tug_matches;
CREATE TRIGGER tug_matches_void_wagers
  BEFORE DELETE ON public.tug_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_tug_void_wagers();

DROP TRIGGER IF EXISTS dodgeball_matches_void_wagers ON public.dodgeball_matches;
CREATE TRIGGER dodgeball_matches_void_wagers
  BEFORE DELETE ON public.dodgeball_matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_dodgeball_void_wagers();

COMMIT;
