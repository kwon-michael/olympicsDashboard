"use client";

import {
  MapPin,
  Navigation,
  Car,
  Toilet,
  TriangleAlert,
  Map as MapIcon,
  Download,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { MapLegend } from "@/components/venue/map-legend";
import {
  PRIMARY_VENUE,
  BACKUP_VENUE,
  SITE_MAP,
  MAP_KEY,
  PARKING_NOTES,
  BATHROOM_NOTES,
  fullAddress,
  embedUrl,
  directionsUrl,
  type Venue,
} from "@/lib/venue";

export default function VenuePage() {
  return (
    <PageTransition>
      {/* Hero */}
      <div className="bg-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium text-white/80">
              August 8, 2026
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            WHERE TO GO
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-white/60">
            {PRIMARY_VENUE.name} — where to park, where the bathrooms are, and
            what happens if we have to move.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
        {/* The venue */}
        <section>
          <SectionHeader
            icon={<MapPin className="h-5 w-5 text-coral" />}
            tint="bg-coral/10"
            title="THE VENUE"
            subtitle="Get here for a 10:00 AM start"
          />
          <VenueCard venue={PRIMARY_VENUE} />
        </section>

        {/* Site map */}
        <section>
          <SectionHeader
            icon={<MapIcon className="h-5 w-5 text-info" />}
            tint="bg-info/10"
            title="SITE MAP"
            subtitle="Where each event runs — see the key below the map"
          />
          {SITE_MAP ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {/* Plain <img>, not next/image: the map is an SVG, and the image
                  optimizer refuses SVG without `dangerouslyAllowSVG`. Serving
                  the vector directly also keeps it sharp at any zoom, which is
                  the whole point of a map you'll squint at on a phone. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SITE_MAP.src}
                alt={SITE_MAP.alt}
                className="mx-auto block h-auto w-full max-w-2xl p-3 sm:p-5"
              />
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-xs text-muted">
                  Open it full size to zoom or print.
                </p>
                <a
                  href={SITE_MAP.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-info hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Full size
                </a>
              </div>
              <div className="border-t border-border bg-background/40 p-5 sm:p-6">
                <MapLegend groups={MAP_KEY} />
              </div>
            </div>
          ) : (
            <Placeholder
              icon={<MapIcon className="h-6 w-6 text-muted" />}
              label="Map coming shortly"
              hint="The site map showing parking, bathrooms, and the event areas will be posted here before game day."
            />
          )}
        </section>

        {/* Parking */}
        <section>
          <SectionHeader
            icon={<Car className="h-5 w-5 text-gold" />}
            tint="bg-gold/10"
            title="PARKING"
            subtitle="Where to leave the car"
          />
          <NoteList
            notes={PARKING_NOTES}
            emptyLabel="Parking details coming shortly"
            emptyHint="Where to park will be confirmed and posted here before game day."
            emptyIcon={<Car className="h-6 w-6 text-muted" />}
          />
        </section>

        {/* Bathrooms */}
        <section>
          <SectionHeader
            icon={<Toilet className="h-5 w-5 text-success" />}
            tint="bg-success/10"
            title="BATHROOMS"
            subtitle="Nearest facilities to the field"
          />
          <NoteList
            notes={BATHROOM_NOTES}
            emptyLabel="Bathroom locations coming shortly"
            emptyHint="The nearest bathrooms will be confirmed and posted here before game day."
            emptyIcon={<Toilet className="h-6 w-6 text-muted" />}
          />
        </section>

        {/* Contingency */}
        <section>
          <SectionHeader
            icon={<TriangleAlert className="h-5 w-5 text-coral" />}
            tint="bg-coral/10"
            title="IF WE HAVE TO MOVE"
            subtitle="Backup venue"
          />
          <div className="mb-4 flex gap-3 rounded-xl border border-coral/30 bg-coral/5 p-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
            <div className="space-y-1.5 text-sm leading-relaxed">
              <p>
                <strong>This is a fallback, not the plan.</strong> Unless you
                hear otherwise, go to {PRIMARY_VENUE.name}.
              </p>
              <p className="text-muted">
                If {PRIMARY_VENUE.name} becomes unavailable, the whole event
                moves to <strong>{BACKUP_VENUE.name}</strong> — about five
                minutes west, same neighbourhood. Any change will be announced
                before game day, so check here before you leave.
              </p>
            </div>
          </div>
          <VenueCard venue={BACKUP_VENUE} muted />
        </section>
      </div>
    </PageTransition>
  );
}

/**
 * A school: address, a directions button, and a live map. Used for both venues —
 * `muted` tones the backup down so it never reads as the place to show up at.
 */
function VenueCard({ venue, muted }: { venue: Venue; muted?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3
            className={
              muted
                ? "font-display text-lg font-semibold text-foreground"
                : "font-display text-xl font-bold text-foreground"
            }
          >
            {venue.name}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {fullAddress(venue)}
          </p>
        </div>
        <a
          href={directionsUrl(venue)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          <Button variant={muted ? "outline" : "primary"} size="sm">
            <Navigation className="h-4 w-4" />
            Directions
          </Button>
        </a>
      </div>
      <iframe
        src={embedUrl(venue)}
        title={`Map of ${venue.name}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-64 w-full border-0 border-t border-border sm:h-80"
      />
    </div>
  );
}

/** A list of on-site notes, or an honest placeholder when we don't have them. */
function NoteList({
  notes,
  emptyLabel,
  emptyHint,
  emptyIcon,
}: {
  notes: string[];
  emptyLabel: string;
  emptyHint: string;
  emptyIcon: React.ReactNode;
}) {
  if (notes.length === 0) {
    return <Placeholder icon={emptyIcon} label={emptyLabel} hint={emptyHint} />;
  }
  return (
    <ul className="space-y-3 rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed text-foreground/90">
      {notes.map((note) => (
        <li key={note} className="flex gap-3">
          <span
            aria-hidden
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral"
          />
          <span>{note}</span>
        </li>
      ))}
    </ul>
  );
}

function Placeholder({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/[0.04]">
        {icon}
      </div>
      <p className="font-display text-base font-semibold text-foreground">
        {label}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {hint}
      </p>
    </div>
  );
}

function SectionHeader({
  icon,
  tint,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}
      >
        {icon}
      </div>
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
