"use client";

function toggle() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {}
}

const SUN = "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z";
const MOON = "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z";

function Icon({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Icon button by default; `labeled` renders a full-width row for menus. */
export function ThemeToggle({ className = "", labeled = false }: { className?: string; labeled?: boolean }) {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={labeled ? undefined : "Toggle day and night"}
      className={
        labeled
          ? `flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition hover:bg-(--road-hover) ${className}`
          : `grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-panel text-ink hover:bg-panel-shade ${className}`
      }
    >
      <Icon d={MOON} className={`dark:hidden ${labeled ? "size-[22px]" : "size-5"}`} />
      <Icon d={SUN} className={`hidden dark:block ${labeled ? "size-[22px]" : "size-5"}`} />
      {labeled && (
        <>
          <span className="dark:hidden">Night mode</span>
          <span className="hidden dark:inline">Day mode</span>
        </>
      )}
    </button>
  );
}
