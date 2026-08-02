import type { MapKeyGroup, MapKeyItem } from "@/lib/venue";

/**
 * The key to the site map. The map itself labels every area, but in type that's
 * unreadable once the whole field is scaled onto a phone — so identification
 * happens here instead, and each swatch is drawn the way the thing appears on
 * the map (filled block, dashed zone, rope, pentagon) rather than as a uniform
 * row of colour chips.
 */
export function MapLegend({ groups }: { groups: MapKeyGroup[] }) {
  return (
    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-3 text-[11px] font-bold tracking-widest text-muted uppercase">
            {group.title}
          </h3>
          <ul className="space-y-2.5">
            {group.items.map((item) => (
              <li key={item.label} className="flex items-start gap-2.5">
                <Swatch item={item} />
                <div className="min-w-0">
                  <p className="text-sm leading-tight font-medium text-foreground">
                    {item.label}
                  </p>
                  {item.note && (
                    <p className="mt-0.5 text-xs leading-snug text-muted">
                      {item.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * A 20×20 swatch echoing the map's own drawing of the item. Every shape carries
 * a hairline dark edge so the white food/registration tents stay visible on the
 * card, and the bag area is stroked rather than filled, as it is on the map.
 */
function Swatch({ item }: { item: MapKeyItem }) {
  const { shape, color } = item;
  return (
    <span aria-hidden className="mt-px shrink-0">
      <svg width="20" height="20" viewBox="0 0 20 20" className="block">
        {shape === "area" && (
          <rect
            x="2"
            y="4"
            width="16"
            height="12"
            rx="2.5"
            fill={color}
            stroke="rgb(0 0 0 / 0.15)"
          />
        )}
        {shape === "zone" && (
          <rect
            x="2.5"
            y="4.5"
            width="15"
            height="11"
            rx="1.5"
            fill={color}
            fillOpacity="0.18"
            stroke={color}
            strokeWidth="1.75"
            strokeDasharray="3 2"
          />
        )}
        {shape === "line" && (
          <line
            x1="2"
            y1="10"
            x2="18"
            y2="10"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}
        {shape === "marker" && (
          <polygon
            points="10,2.5 17.5,8 14.6,16.8 5.4,16.8 2.5,8"
            fill={color}
            stroke="rgb(0 0 0 / 0.25)"
          />
        )}
        {shape === "tent" && (
          <polygon
            points="10,3 18,17 2,17"
            fill={color}
            stroke="rgb(0 0 0 / 0.35)"
          />
        )}
        {shape === "ring" && (
          <ellipse
            cx="10"
            cy="10"
            rx="8"
            ry="5.5"
            fill="none"
            stroke={color}
            strokeWidth="1.75"
          />
        )}
      </svg>
    </span>
  );
}
