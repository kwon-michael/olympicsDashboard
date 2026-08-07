import { describe, it, expect } from "vitest";
import {
  canBypassLeaderboardHide,
  canViewLeaderboard,
  DEFAULT_SETTINGS,
} from "@/lib/settings";
import type { UserRole } from "@/lib/types";

const ROLES: (UserRole | null)[] = [
  "admin",
  "volunteer",
  "captain",
  "participant",
  null,
];

describe("canViewLeaderboard", () => {
  it("shows the board to everyone while the switch is off", () => {
    for (const role of ROLES) {
      expect(canViewLeaderboard(false, role)).toBe(true);
    }
  });

  it("hides it from everyone but admins while the switch is on", () => {
    expect(canViewLeaderboard(true, "admin")).toBe(true);
    for (const role of ROLES.filter((r) => r !== "admin")) {
      expect(canViewLeaderboard(true, role)).toBe(false);
    }
  });

  it("hides it from volunteers, who work the score desk all day", () => {
    expect(canBypassLeaderboardHide("volunteer")).toBe(false);
  });

  it("treats an unresolved role as a member of the public", () => {
    expect(canViewLeaderboard(true, undefined)).toBe(false);
  });
});

describe("DEFAULT_SETTINGS", () => {
  it("leaves the board visible, so a settings failure can't take it down", () => {
    expect(DEFAULT_SETTINGS.leaderboard_hidden).toBe(false);
  });
});
