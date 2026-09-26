"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectVehicle } from "@/actions/vehicles";

const ADD = "__add__";

export function VehicleSelector({ vehicles, selectedId }: { vehicles: { id: string; title: string }[]; selectedId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    if (value === ADD) return router.push("/vehicles/new");
    startTransition(() => selectVehicle(value));
  }

  if (!vehicles.length) return <span className="truncate text-sm text-ink-soft">No vehicle yet</span>;

  return (
    <label className="block min-w-0 flex-1 md:max-w-xs">
      <span className="sr-only">Selected vehicle</span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        aria-busy={pending || undefined}
        className={`field-select truncate py-2 font-medium ${pending ? "animate-pulse" : ""}`}
      >
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
        <option value={ADD}>+ Add vehicle…</option>
      </select>
    </label>
  );
}
