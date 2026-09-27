"use client";

import { type CSSProperties, useEffect, useRef } from "react";

const WHEEL_OFFSETS = [0, 50];
const OUTLINE = { stroke: "#27364d", strokeWidth: 2, strokeLinejoin: "round" } as const;

const DEBRIS = [
  { d: "M91 27h2v2h-2z", fill: "#b8413b", dx: "-4px", dy: "12px" },
  { d: "M90 24h1v1h-1z", fill: "#ffe07a", dx: "-8px", dy: "15px" },
  { d: "M91 31h3v1h-3z", fill: "#27364d", dx: "-2px", dy: "8px" },
];

const CANOPY = "M87 3h10v2h3v2h2v3h1v9h-1v3h-2v2h-3v2H87v-2h-3v-2h-2v-3h-1v-9h1V7h2V5h3z";

const LEAVES = [
  { d: "M85 20h2v1h-2z", dx: "-3px", dy: "19px" },
  { d: "M97 18h2v1h-2z", dx: "3px", dy: "21px" },
  { d: "M92 15h2v1h-2z", dx: "-2px", dy: "24px" },
];

const SMOKE = ["M79 13h1v-1h2v1h1v2h-1v1h-2v-1h-1z", "M82 12h1v-1h2v1h1v2h-1v1h-2v-1h-1z", "M80 10h1v-1h2v1h1v2h-1v1h-2v-1h-1z"];

/**
 * public/scenery/car.svg with round wheels, on a 7s loop (globals.css `crash-*`): drives for 2s while a tree rolls in
 * from the right, hits it and sits wrecked (crumpled hood, cracked glass, smoke, hazards) until both respawn.
 */
export function CrashCar({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  // Each part is its own CSS animation, so one that (re)starts late (hot reload, a class swap) would crash out of
  // step on every loop. Pin every crash-* animation to the car's clock whenever any of them starts.
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const sync = () => {
      const anims = svg
        .getAnimations({ subtree: true })
        .filter((a): a is CSSAnimation => a instanceof CSSAnimation && a.animationName.startsWith("crash-"));
      const clock = anims.find((a) => a.animationName === "crash-car");
      clock?.ready.then(() => {
        for (const a of anims) if (a !== clock) a.startTime = clock.startTime;
      });
    };
    sync();
    svg.addEventListener("animationstart", sync);
    return () => svg.removeEventListener("animationstart", sync);
  }, []);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 44"
      width={480}
      height={176}
      shapeRendering="crispEdges"
      overflow="visible"
      aria-hidden="true"
      className={className}
    >
      <path fill="#27364d" fillOpacity=".22" d="M8 39h82v3H8z" />

      <g className="crash-tree">
        <path fill="#27364d" fillOpacity=".22" d="M84 39h16v3H84z" />
        <path fill="#8b5a2b" {...OUTLINE} d="M90 24h4v15h2v2h-8v-2h2z" />
        <g className="crash-tree-shake">
          <path fill="#4caf50" {...OUTLINE} d={CANOPY} />
          <path fill="#2e7d32" d="M83 19h4v2h-4zM95 21h5v2h-5zM99 16h2v3h-2zM88 23h3v1h-3z" />
          <path fill="#7bc96f" d="M85 8h4v3h-4zM89 6h3v2h-3zM95 10h3v2h-3zM91 13h2v2h-2z" />
        </g>
      </g>

      <g className="crash-car">
        <g className="crash-hide" {...OUTLINE}>
          <path fill="#d9534a" d="M24 20 32 8h30l12 12h12l6 4v10H6V24l6-4z" />
          <path fill="#b8413b" d="M6 30h86v4H6z" />
          <path fill="#9fd3f5" d="M29 19 34 11h12v8zM50 19v-8h10l8 8z" />
          <path fill="#ffe07a" d="M86 23h5v4h-5z" />
        </g>
        <g className="crash-show" {...OUTLINE}>
          <path fill="#d9534a" d="M24 20 32 8h30l12 12h4l3-3 3 4 3-1 2 4v10H6V24l6-4z" />
          <path fill="#b8413b" d="M6 30h81l2 2v2H6z" />
          <path fill="#9fd3f5" d="M29 19 34 11h12v8zM50 19v-8h10l8 8z" />
          <path fill="#4a4a5c" d="M84 24h3v3h-3z" />
        </g>
        <path fill="#ff8a65" stroke="#27364d" strokeWidth="2" strokeLinejoin="round" d="M6 23h4v4H6z" />
        <path fill="#fff" fillOpacity=".45" d="M35 12h3v2h-3zM51 12h3v2h-3z" />
        <path fill="#27364d" d="M47 21h2v8h-2zM44 23h3v1h-3z" />
        <g className="crash-show">
          <path fill="#27364d" d="M60 12h1v2h-1zM59 14h1v1h-1zM60 15h2v1h-2zM61 16h1v2h-1zM62 17h2v1h-2z" />
          <path className="hazard" fill="#ffc34d" d="M7 24h2v2H7zM82 27h3v2h-3z" />
          {SMOKE.map((d, i) => (
            <path
              key={d}
              className="smoke"
              fill="#c8d0dc"
              stroke="#8a93a3"
              strokeWidth="0.5"
              d={d}
              style={{ animationDelay: `${-i * 0.5}s` }}
            />
          ))}
        </g>

        {WHEEL_OFFSETS.map((dx) => (
          <g key={dx} transform={`translate(${dx} 0)`}>
            <path
              fill="#2a2a3c"
              {...OUTLINE}
              d="M21 30h4v1h2v1h1v2h1v4h-1v2h-1v1h-2v1h-4v-1h-2v-1h-1v-2h-1v-4h1v-2h1v-1h2z"
            />
            <path fill="#c8d0dc" d="M21 33h4v1h1v4h-1v1h-4v-1h-1v-4h1z" />
            <g className="crash-hide">
              <path className="wheel-a" fill="#27364d" d="M22 33h2v6h-2zM20 35h6v2h-6z" />
              <path
                className="wheel-b"
                fill="#27364d"
                d="M21 34h1v1h-1zM22 35h1v1h-1zM23 36h1v1h-1zM24 37h1v1h-1zM24 34h1v1h-1zM23 35h1v1h-1zM22 36h1v1h-1zM21 37h1v1h-1z"
              />
            </g>
            <path className="crash-show" fill="#27364d" d="M22 33h2v6h-2zM20 35h6v2h-6z" />
          </g>
        ))}
      </g>

      {DEBRIS.map(({ d, fill, dx, dy }) => (
        <path key={d} className="crash-debris" fill={fill} d={d} style={{ "--dx": dx, "--dy": dy } as CSSProperties} />
      ))}

      {LEAVES.map(({ d, dx, dy }) => (
        <path key={d} className="crash-leaf" fill="#4caf50" d={d} style={{ "--dx": dx, "--dy": dy } as CSSProperties} />
      ))}

      <g className="crash-flash" transform="translate(85 21)">
        <path fill="#ff8a65" d="M5 0h1v3H5zM5 8h1v3H5zM0 5h3v1H0zM8 5h3v1H8zM1 1h2v2H1zM8 1h2v2H8zM1 8h2v2H1zM8 8h2v2H8z" />
        <path fill="#ffe07a" d="M3 3h5v5H3z" />
        <path fill="#fff" d="M5 4h1v3H5zM4 5h3v1H4z" />
      </g>
    </svg>
  );
}
