"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { selectVehicle } from "@/actions/vehicles";
import { CAR_ICON, NavIcon, VEHICLE_MENU_ID, isActive } from "./BottomNav";

export type VehicleOption = { id: string; title: string };

export function VehicleSelector({
  vehicles,
  selectedId,
  item,
  current,
  idle,
  list = "",
  onDone,
}: {
  vehicles: VehicleOption[];
  selectedId: string | null;
  item: string;
  current: string;
  idle: string;
  list?: string;
  onDone?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const path = usePathname();

  return (
    <div className={pending ? "animate-pulse" : ""} aria-busy={pending || undefined}>
      <ul className={`space-y-1 ${list}`}>
        {vehicles.map((v) => {
          const selected = v.id === selectedId;
          const active = selected && isActive(path, "/garage");
          return (
            <li key={v.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                disabled={pending}
                onClick={() => {
                  onDone?.();
                  startTransition(async () => {
                    if (!selected) await selectVehicle(v.id);
                    router.push("/garage");
                  });
                }}
                className={`${item} text-left ${active ? current : idle}`}
              >
                <NavIcon paths={CAR_ICON} active={active} />
                <span className="min-w-0 truncate">{v.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Link href="/vehicles/new" onClick={onDone} className={`${item} ${idle} mt-1`}>
        <NavIcon paths={["M12 5v14M5 12h14"]} active={false} />
        Add vehicle
      </Link>
    </div>
  );
}

export function VehicleMenu({ vehicles, selectedId }: { vehicles: VehicleOption[]; selectedId: string | null }) {
  const menu = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={menu}
      id={VEHICLE_MENU_ID}
      popover="auto"
      className="inset-x-3 top-auto bottom-[calc(4.75rem+env(safe-area-inset-bottom))] m-0 max-h-[60dvh] w-auto overflow-y-auto rounded-xl border border-border bg-panel p-2 text-ink shadow-[0_8px_24px_var(--shadow)] backdrop:bg-black/25"
    >
      <p className="px-3 pt-2 pb-1 text-xs font-semibold text-ink-soft">Vehicles</p>
      <VehicleSelector
        vehicles={vehicles}
        selectedId={selectedId}
        item="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-base font-medium transition"
        current="bg-accent-soft text-accent"
        idle="hover:bg-panel-shade"
        onDone={() => menu.current?.hidePopover()}
      />
    </div>
  );
}
