"use client";

import { useState, useTransition } from "react";
import { selectVehicle } from "@/actions/vehicles";
import { CAR_ICON, NavIcon } from "@/components/layout/BottomNav";
import type { VehicleOption } from "@/components/layout/VehicleSelector";

export function CarSwitcher({ vehicles, selectedId }: { vehicles: (VehicleOption & { plate: string })[]; selectedId: string }) {
  const [target, setTarget] = useState(selectedId);
  const [pending, startTransition] = useTransition();
  const current = pending ? target : selectedId;

  return (
    <nav aria-label="Switch car" aria-busy={pending || undefined} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:px-0">
      {vehicles.map((v) => {
        const on = v.id === current;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={on}
            disabled={pending}
            onClick={() => {
              if (v.id === selectedId) return;
              setTarget(v.id);
              startTransition(() => selectVehicle(v.id));
            }}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition disabled:cursor-wait ${
              on ? "border-accent bg-accent-soft text-accent" : "border-border bg-panel text-ink hover:bg-panel-shade"
            } ${pending && on ? "animate-pulse" : ""}`}
          >
            <NavIcon paths={CAR_ICON} active={on} />
            <span className="max-w-44 truncate">{v.title}</span>
            <span className="text-xs font-medium opacity-70">{v.plate}</span>
          </button>
        );
      })}
    </nav>
  );
}
