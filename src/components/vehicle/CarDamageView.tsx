"use client";

import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import type { AggregatedDamage, ComponentId } from "@/types";
import { CarDamageMap2D } from "./CarDamageMap2D";

type Props = { damage: AggregatedDamage[]; focused?: ComponentId | null; onSelect?: (id: ComponentId) => void; modelId?: string | null };

const Car3D = dynamic(() => import("./Car3D"), {
  ssr: false,
  loading: () => <p className="absolute inset-0 grid place-items-center text-sm text-ink-soft">Loading 3D car…</p>,
});

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** 3D car (GLB) with the 2D map as the accessible view and the fallback when WebGL or the model fails. */
export function CarDamageView(props: Props) {
  const [view, setView] = useState<"3d" | "map">("3d");
  const map = (
    <div className="flex h-full items-center justify-center">
      <CarDamageMap2D {...props} />
    </div>
  );
  return (
    <div className="relative h-[300px] w-full md:h-[380px]">
      {view === "map" ? (
        map
      ) : (
        <WebGLBoundary
          fallback={
            <>
              {map}
              <p className="absolute bottom-2 left-2 text-xs text-ink-soft">3D view unavailable on this device.</p>
            </>
          }
        >
          <Car3D {...props} />
        </WebGLBoundary>
      )}
      <div role="group" aria-label="Car view" className="absolute right-2 top-2 flex rounded-lg border border-border bg-panel/90 p-0.5 text-xs font-semibold">
        {(["3d", "map"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`min-h-8 rounded-md px-3 ${view === v ? "bg-accent text-accent-ink" : "text-ink"}`}
          >
            {v === "3d" ? "3D" : "2D"}
          </button>
        ))}
      </div>
    </div>
  );
}
