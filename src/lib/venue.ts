// ============================================
// Where the games are held
// ============================================
// One place for everything the /venue page needs: the two schools, the on-site
// map, and the parking/bathroom notes. It's plain data rather than page markup
// so the address can't drift between the venue page, the home page, and any
// link that points at either school.
//
// Both schools are York Region DSB sites in Thornhill, a few minutes apart —
// which is what makes Charlton a workable fallback.

export interface Venue {
  name: string;
  /** Street line, exactly as the school board writes it. */
  street: string;
  city: string;
  postalCode: string;
}

/** Hodan Nalayeh Secondary School — where the games are held. */
export const PRIMARY_VENUE: Venue = {
  name: "Hodan Nalayeh Secondary School",
  street: "1401 Clark Ave. W.",
  city: "Thornhill, ON",
  postalCode: "L4J 7R4",
};

/**
 * Charlton Public School — the fallback if Hodan Nalayeh falls through. About a
 * 5-minute drive west; same neighbourhood, so directions stay familiar.
 */
export const BACKUP_VENUE: Venue = {
  name: "Charlton Public School",
  street: "121 Joseph Aaron Blvd.",
  city: "Thornhill, ON",
  postalCode: "L4J 6J5",
};

/**
 * Dufferin Clark Community Centre — not a venue, but the answer to both
 * on-site questions: the overflow lot when the school lot is fenced off, and
 * the bathrooms that stay open all day. A City of Vaughan facility one block
 * east of Hodan Nalayeh, close enough to share its postal code.
 */
export const OVERFLOW_VENUE: Venue = {
  name: "Dufferin Clark Community Centre",
  street: "1441 Clark Ave. W.",
  city: "Thornhill, ON",
  postalCode: "L4J 7R4",
};

/** "1401 Clark Ave. W., Thornhill, ON L4J 7R4" */
export function fullAddress(venue: Venue): string {
  return `${venue.street}, ${venue.city} ${venue.postalCode}`;
}

/** What we hand to Google — the school name pins more reliably than the street. */
function mapQuery(venue: Venue): string {
  return encodeURIComponent(`${venue.name}, ${fullAddress(venue)}`);
}

/**
 * Keyless embeddable map. The `/maps/embed/v1/` endpoint needs a billed API key;
 * this older `output=embed` form doesn't, which keeps the venue page free of
 * both a key and a Google Cloud project.
 */
export function embedUrl(venue: Venue): string {
  return `https://maps.google.com/maps?q=${mapQuery(venue)}&z=16&output=embed`;
}

/** Opens the native maps app on phones, google.com/maps on desktop. */
export function directionsUrl(venue: Venue): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${mapQuery(venue)}`;
}

/**
 * The site map handed out on the day. Null renders an honest "map coming"
 * placeholder rather than a broken image.
 */
export interface SiteMap {
  /** The artwork, served from /public. Vector, so it stays sharp zoomed in. */
  src: string;
  alt: string;
}

/**
 * Cropped from the source export (`Casualympics Map.svg`), which carried an
 * empty top half — roughly 52% of a 917×2986 canvas — leaving the field itself
 * in the bottom portion. Only the root `viewBox` was retargeted to the content's
 * bounding box, so this is the same vector artwork, not a re-render: nothing was
 * flattened, redrawn, or resampled. Re-crop from the source rather than from
 * this file if the map is ever revised.
 */
export const SITE_MAP: SiteMap | null = {
  src: "/casualympics-map.svg",
  alt:
    "Site map of the field: a running track enclosing the event areas — " +
    "shotput, garbage basketball, triple jump and standing long jump, three " +
    "tail grab zones, two tug of war lanes, two dodgeball fields, and the " +
    "food, registration and bag areas along the bottom.",
};

/* ------------------------------------------------------------------ */
/*  Map legend                                                         */
/* ------------------------------------------------------------------ */

/**
 * How a legend entry is drawn, mirroring how the thing appears on the map:
 *  - "area"    a filled block (shotput, dodgeball, the track)
 *  - "zone"    a dashed outline over a translucent fill (the tail grab zones)
 *  - "line"    a stroke (the tug of war ropes)
 *  - "marker"  a numbered pentagon (the relay legs)
 *  - "tent"    a triangle (food, registration)
 *  - "ring"    an outlined ellipse (the bag area)
 */
export type MapKeyShape = "area" | "zone" | "line" | "marker" | "tent" | "ring";

export interface MapKeyItem {
  label: string;
  /** Taken from the artwork itself, so the swatch always matches the map. */
  color: string;
  shape: MapKeyShape;
  note?: string;
}

export interface MapKeyGroup {
  title: string;
  items: MapKeyItem[];
}

/**
 * The key to the site map. The map labels each area in small type that's
 * unreadable on a phone, so this carries the identification instead — the
 * colours below are lifted straight out of the SVG rather than eyeballed.
 *
 * The numbered pentagons are the one thing the map can't explain on its own:
 * they're the five legs of the Conditional Relay, not a numbered legend.
 */
export const MAP_KEY: MapKeyGroup[] = [
  {
    title: "Solo events",
    items: [
      { label: "Shotput", color: "#5ac4f6", shape: "area" },
      {
        label: "Garbage basketball",
        color: "#bfbfbf",
        shape: "marker",
        note: "Three bins, increasing distance",
      },
      {
        label: "Triple jump & standing long jump",
        color: "#64c466",
        shape: "area",
        note: "Shared strip on the east side",
      },
      {
        label: "Running track",
        color: "#ea4d3d",
        shape: "area",
        note: "Encloses the whole field",
      },
    ],
  },
  {
    title: "Team events",
    items: [
      { label: "Tail Grab zone #1", color: "#d80001", shape: "zone" },
      { label: "Tail Grab zone #2", color: "#782cf6", shape: "zone" },
      { label: "Tail Grab zone #3", color: "#00ec00", shape: "zone" },
      {
        label: "Tug of War",
        color: "#eb539f",
        shape: "line",
        note: "Two ropes, #1 and #2",
      },
      {
        label: "Dodgeball",
        color: "#f6ce46",
        shape: "area",
        note: "Two fields, #1 and #2",
      },
      {
        label: "Conditional Relay legs",
        color: "#ef8c00",
        shape: "marker",
        note: "The five numbered pentagons — one per leg",
      },
    ],
  },
  {
    title: "Around the field",
    items: [
      { label: "Food", color: "#ffffff", shape: "tent" },
      { label: "Registration", color: "#ffffff", shape: "tent" },
      { label: "Bag area", color: "#111111", shape: "ring" },
    ],
  },
];

/**
 * On-site directions. Neither is marked on the site map, so these carry it.
 * An empty array renders as "to be confirmed" rather than being guessed at —
 * sending ninety people to the wrong door is worse than telling them the
 * detail isn't posted yet.
 *
 * Dufferin Clark Community Centre backs onto the school, which is why it
 * answers both questions: the overflow lot and the open bathrooms.
 */
export const PARKING_NOTES: string[] = [
  "Park in the school lot at Hodan Nalayeh if it's open — it's the closest spot to the field.",
  "If the school lot is fenced off, park at Dufferin Clark Community Centre, a short walk away.",
  "Otherwise, there's street parking across the street from the school.",
];

export const BATHROOM_NOTES: string[] = [
  "Dufferin Clark Community Centre has bathrooms open inside the building, a short walk from the field.",
];
