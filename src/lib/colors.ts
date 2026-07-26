// ============================================
// Team colors
// ============================================
// Teams are identified by color instead of a number. This is the canonical
// list of the nine team colors (name + hex). It's the source of truth for the
// seed/migration SQL; the running app reads the actual name/color off each
// roster_teams row, so this list mainly documents the palette and powers
// `readableTextColor` for legible initials on a colored tile.

export interface TeamColor {
  name: string;
  hex: string;
}

export const TEAM_COLORS: TeamColor[] = [
  { name: "Red", hex: "#EF4444" },
  { name: "Green", hex: "#22C55E" },
  { name: "Dark Blue", hex: "#1E40AF" },
  { name: "Light Blue", hex: "#38BDF8" },
  { name: "Yellow", hex: "#FACC15" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Orange", hex: "#F97316" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Grey", hex: "#6B7280" },
];

/**
 * Pick a legible text color (near-black or white) for text drawn on top of a
 * solid `bg` hex. Uses the perceptual YIQ brightness so light tiles (yellow,
 * light blue) get dark text while dark tiles (red, dark blue) get white text.
 * Falls back to white for anything it can't parse.
 */
export function readableTextColor(bg: string): string {
  const hex = bg.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return "#FFFFFF";
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#FFFFFF";
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#1A1A1A" : "#FFFFFF";
}
