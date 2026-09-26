"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth";
import { NAV, NavIcon, isActive } from "./BottomNav";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

const item = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition";
const idle = "hover:bg-white/60 dark:hover:bg-white/10";
const current = "bg-panel text-brand shadow-[0_1px_2px_rgb(28_46_25/0.14),0_0_0_1px_var(--meadow-line)]";

/** Desktop navigation (md and up). Phones use BottomNav. */
export function AppSidebar({ email }: { email: string }) {
  const path = usePathname();
  return (
    <aside className="meadow fixed inset-y-0 left-0 z-30 hidden w-60 flex-col md:flex">
      <div className="border-b border-meadow-line px-4 py-4">
        <Wordmark tagline />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-xs font-semibold text-meadow-ink/70">Your car</p>
        <ul className="space-y-1">
          {NAV.map((t) => {
            const active = isActive(path, t.href);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={active ? "page" : undefined} className={`${item} ${active ? current : idle}`}>
                  <NavIcon paths={t.icon} active={active} />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-meadow-line px-3 py-3">
        <Link href="/profile" aria-current={isActive(path, "/profile") ? "page" : undefined} className={`${item} ${isActive(path, "/profile") ? current : idle}`}>
          <NavIcon paths={["M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M5 20c.9-3.4 3.6-5 7-5s6.1 1.6 7 5"]} active={false} />
          Profile
        </Link>
        <ThemeToggle labeled />
        <form action={logout}>
          <button type="submit" className={`${item} ${idle}`}>
            <NavIcon paths={["M15 4h4v16h-4", "M10 8l-4 4 4 4", "M6 12h10"]} active={false} />
            Log out
          </button>
        </form>
        <p className="truncate px-3 pt-1 text-xs text-meadow-ink/70">{email}</p>
      </div>
    </aside>
  );
}
