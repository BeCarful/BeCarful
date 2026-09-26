"use client";

import { COMPONENT_IDS, componentLabel, type AggregatedDamage, type ComponentId, type Severity } from "@/types";

type Pt = [number, number];
const W = 240;
const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [W - x, y]);

const LEFT: Record<string, Pt[]> = {
  headlight: [[54, 28], [84, 28], [84, 40], [54, 40]],
  fender: [[54, 40], [70, 40], [70, 124], [50, 124], [50, 44]],
  frontDoor: [[50, 124], [70, 124], [84, 154], [84, 192], [50, 192]],
  rearDoor: [[50, 192], [84, 192], [84, 250], [50, 250]],
  quarter: [[50, 250], [84, 250], [70, 278], [70, 352], [54, 352], [50, 348]],
  taillight: [[54, 352], [84, 352], [84, 364], [54, 364]],
  frontWheel: [[36, 58], [50, 58], [50, 106], [36, 106]],
  rearWheel: [[36, 282], [50, 282], [50, 330], [36, 330]],
  mirror: [[40, 130], [50, 130], [50, 138], [40, 138]],
};
const left = (k: string) => poly(LEFT[k]);
const right = (k: string) => poly(mirror(LEFT[k]));

// Top-down, front at the top, so the car's left is on the viewer's left.
const REGIONS: Record<ComponentId, string> = {
  front_bumper: poly([[62, 12], [178, 12], [186, 20], [186, 28], [54, 28], [54, 20]]),
  hood: poly([[84, 28], [156, 28], [156, 40], [170, 40], [170, 124], [70, 124], [70, 40], [84, 40]]),
  windshield: poly([[70, 124], [170, 124], [156, 154], [84, 154]]),
  roof: poly([[84, 154], [156, 154], [156, 250], [84, 250]]),
  rear_window: poly([[84, 250], [156, 250], [170, 278], [70, 278]]),
  trunk: poly([[70, 278], [170, 278], [170, 352], [156, 352], [156, 364], [84, 364], [84, 352], [70, 352]]),
  rear_bumper: poly([[54, 364], [186, 364], [186, 372], [178, 380], [62, 380], [54, 372]]),
  left_headlight: left("headlight"),
  right_headlight: right("headlight"),
  front_left_fender: left("fender"),
  front_right_fender: right("fender"),
  front_left_door: left("frontDoor"),
  front_right_door: right("frontDoor"),
  rear_left_door: left("rearDoor"),
  rear_right_door: right("rearDoor"),
  rear_left_quarter: left("quarter"),
  rear_right_quarter: right("quarter"),
  left_taillight: left("taillight"),
  right_taillight: right("taillight"),
  front_left_wheel: left("frontWheel"),
  front_right_wheel: right("frontWheel"),
  rear_left_wheel: left("rearWheel"),
  rear_right_wheel: right("rearWheel"),
};

const DAMAGE_FILL: Record<Severity, string> = {
  minor: "color-mix(in srgb, var(--danger) 55%, white)",
  moderate: "var(--danger)",
  severe: "color-mix(in srgb, var(--danger) 60%, black)",
};

function baseFill(id: ComponentId) {
  if (id.endsWith("wheel")) return "var(--car-tire)";
  if (id === "windshield" || id === "rear_window") return "var(--car-glass)";
  if (id.endsWith("headlight")) return "var(--car-headlight)";
  if (id.endsWith("taillight")) return "var(--car-taillight)";
  if (id.endsWith("bumper")) return "var(--car-trim)";
  return "var(--car-body)";
}

const PALETTE =
  "[--car-body:#d6dee9] [--car-trim:#a9b5c7] [--car-glass:#8fd3fe] [--car-tire:#26263a] [--car-headlight:#fff1a8] [--car-taillight:#f5a26b] " +
  "dark:[--car-body:#7b88a6] dark:[--car-trim:#5d6883] dark:[--car-glass:#29466e] dark:[--car-headlight:#ffe45c] dark:[--car-taillight:#d9825f]";

export function CarDamageMap2D({
  damage,
  focused = null,
  onSelect,
}: {
  damage: AggregatedDamage[];
  focused?: ComponentId | null;
  onSelect?: (id: ComponentId) => void;
}) {
  const byId = new Map(damage.map((d) => [d.component, d]));
  return (
    <svg
      viewBox="0 -4 240 396"
      role="group"
      aria-label="Car damage map"
      shapeRendering="crispEdges"
      className={`mx-auto block h-[240px] w-auto max-w-full md:h-[300px] ${PALETTE}`}
    >
      <rect x={56} y={16} width={138} height={368} style={{ fill: "var(--shadow)" }} />
      <path d={left("mirror")} style={{ fill: "var(--car-body)" }} className="stroke-border [stroke-width:2]" />
      <path d={right("mirror")} style={{ fill: "var(--car-body)" }} className="stroke-border [stroke-width:2]" />
      {COMPONENT_IDS.map((id) => {
        const d = byId.get(id);
        const label = componentLabel(id);
        return (
          <path
            key={id}
            d={REGIONS[id]}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={focused === id}
            onClick={() => onSelect?.(id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(id);
              }
            }}
            style={{ fill: d ? DAMAGE_FILL[d.severity] : baseFill(id) }}
            className="cursor-pointer stroke-border outline-none transition-[fill] duration-700 [stroke-width:2] hover:brightness-110 focus-visible:stroke-accent focus-visible:[stroke-width:4]"
          >
            <title>{d ? `${label}: ${d.severity} damage` : label}</title>
          </path>
        );
      })}
      {focused && (
        <path d={REGIONS[focused]} fill="none" className="pointer-events-none animate-pulse stroke-accent [stroke-width:5]" />
      )}
      <text x={120} y={6} textAnchor="middle" className="pixel-text fill-ink-soft text-[7px]">
        FRONT
      </text>
      <text x={120} y={391} textAnchor="middle" className="pixel-text fill-ink-soft text-[7px]">
        REAR
      </text>
      <text x={22} y={200} textAnchor="middle" className="pixel-text fill-ink-soft text-[8px]">
        L
      </text>
      <text x={218} y={200} textAnchor="middle" className="pixel-text fill-ink-soft text-[8px]">
        R
      </text>
    </svg>
  );
}
