import { describe, it, expect } from "vitest";
import {
  PLAYOFF_STAGES,
  stageLabel,
  isOpenForBets,
  wagersByMatch,
  type PlayoffMatch,
} from "@/lib/wagers";
import type { WagerTournament } from "@/lib/types";
import { match, wager } from "@/lib/test-fixtures";
import type { TournamentStage } from "@/lib/tournament";

/** A bracket match tagged with its tournament, with both teams set and undecided. */
function playoff(
  overrides: Partial<PlayoffMatch> = {},
  tournament: WagerTournament = "tug"
): PlayoffMatch {
  return {
    ...match({
      stage: "final" as TournamentStage,
      team_a: "team-a",
      team_b: "team-b",
      ...overrides,
    }),
    tournament: overrides.tournament ?? tournament,
  };
}

describe("stageLabel", () => {
  it("names each playoff stage", () => {
    expect(stageLabel("semi")).toBe("Semifinal");
    expect(stageLabel("final")).toBe("Final");
    expect(stageLabel("third")).toBe("3rd-place");
  });

  it("passes unknown stages through unchanged", () => {
    expect(stageLabel("group")).toBe("group");
  });
});

describe("isOpenForBets", () => {
  it("accepts every playoff stage when both teams are set and undecided", () => {
    for (const stage of PLAYOFF_STAGES) {
      expect(isOpenForBets(playoff({ stage }))).toBe(true);
    }
  });

  it("rejects non-playoff matches", () => {
    expect(isOpenForBets(playoff({ stage: "group" as TournamentStage }))).toBe(
      false
    );
  });

  it("rejects a match whose teams are not both filled in yet", () => {
    expect(isOpenForBets(playoff({ team_a: null }))).toBe(false);
    expect(isOpenForBets(playoff({ team_b: null }))).toBe(false);
  });

  it("rejects a match that already has a winner", () => {
    expect(isOpenForBets(playoff({ winner_id: "team-a" }))).toBe(false);
  });
});

describe("wagersByMatch", () => {
  it("keys wagers by tournament and match", () => {
    const w = wager({ tournament: "tug", match_id: "m1" });
    expect(wagersByMatch([w]).get("tug:m1")).toBe(w);
  });

  it("keeps the same match id in each tournament separate", () => {
    const tug = wager({ tournament: "tug", match_id: "m1" });
    const dodge = wager({ tournament: "dodgeball", match_id: "m1" });
    const byMatch = wagersByMatch([tug, dodge]);

    expect(byMatch.get("tug:m1")).toBe(tug);
    expect(byMatch.get("dodgeball:m1")).toBe(dodge);
  });

  it("omits voided wagers so the match reads as un-bet again", () => {
    const voided = wager({ match_id: "m1", status: "void" });
    expect(wagersByMatch([voided]).has("tug:m1")).toBe(false);
  });

  it("indexes settled wagers alongside pending ones", () => {
    const won = wager({ match_id: "m1", status: "won", net_points: 1 });
    const lost = wager({ match_id: "m2", status: "lost", net_points: -1 });
    const byMatch = wagersByMatch([won, lost]);

    expect(byMatch.get("tug:m1")).toBe(won);
    expect(byMatch.get("tug:m2")).toBe(lost);
  });

  it("returns an empty index for no wagers", () => {
    expect(wagersByMatch([]).size).toBe(0);
  });
});
