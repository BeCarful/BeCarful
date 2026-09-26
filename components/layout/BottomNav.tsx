"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "Home", icon: ["M3 10.5 12 3l9 7.5", "M5.5 9.5V20h13V9.5", "M10 20v-5h4v5"] },
  { href: "/chat", label: "Chat", icon: ["M4 5h16v11H9l-5 4V5Z", "M8 9.5h8M8 12.5h5"] },
  { href: "/summary", label: "Summary", icon: ["M7 4h10v17H7z", "M9.5 2.5h5v3h-5z", "m9.5 12 1.8 1.8 3.5-3.6", "M10 17h4"] },
] as const;

export function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function NavIcon({ paths, active }: { paths: readonly string[]; active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[22px] shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {NAV.map((t) => {
          const active = isActive(path, t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition ${active ? "text-accent" : "text-ink-soft hover:text-ink"}`}
              >
                {active && <span aria-hidden className="absolute top-0 h-1 w-10 rounded-b-[3px] bg-accent" />}
                <NavIcon paths={t.icon} active={active} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
