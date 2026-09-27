"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth";
import { NAV, NavIcon, isActive } from "./BottomNav";
import { ThemeToggle } from "./ThemeToggle";
import { VehicleSelector, type VehicleOption } from "./VehicleSelector";
import { PixelCar, Wordmark } from "./Wordmark";

const item = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition";
const idle = "hover:bg-(--road-hover)";
const current = "road-sign";

/** Desktop navigation (md and up). Phones use BottomNav. */
export function AppSidebar({ email, vehicles, selectedId }: { email: string; vehicles: VehicleOption[]; selectedId: string | null }) {
  const path = usePathname();
  return (
    <aside className="road fixed inset-y-0 left-0 z-30 hidden w-60 flex-col md:flex">
      <span key={path} aria-hidden className="road-line" />
      <div className="border-b border-border px-4 py-4">
        <Wordmark tagline />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-xs font-semibold text-ink-soft">Vehicles</p>
        <VehicleSelector vehicles={vehicles} selectedId={selectedId} item={item} current={current} idle={idle} />
        <p className="px-3 pt-5 pb-2 text-xs font-semibold text-ink-soft">Your car</p>
        <ul className="space-y-1">
          {NAV.map((t) => {
            const active = isActive(path, t.href);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={active ? "page" : undefined} className={`${item} ${active ? current : idle}`}>
                  <NavIcon paths={t.icon} active={active} />
                  {t.label}
                  {active && <PixelCar className="ml-auto h-3 w-auto" windows="fill-(--road-sign)" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-border px-3 py-3">
        <Link href="/profile" aria-current={isActive(path, "/profile") ? "page" : undefined} className={`${item} ${isActive(path, "/profile") ? current : idle}`}>
          <NavIcon paths={["M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M5 20c.9-3.4 3.6-5 7-5s6.1 1.6 7 5"]} active={false} />
          <span className="min-w-0 py-1.5">
            <span className="block">Profile</span>
            <span className="block truncate text-xs font-normal text-ink-soft">{email}</span>
          </span>
        </Link>
        <ThemeToggle labeled />
        <form action={logout}>
          <button type="submit" className={`${item} ${idle}`}>
            <NavIcon paths={["M15 4h4v16h-4", "M10 8l-4 4 4 4", "M6 12h10"]} active={false} />
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
