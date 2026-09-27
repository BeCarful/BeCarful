import Link from "next/link";
import type { ReactNode } from "react";
import { RetroBadge, RetroCard } from "@/components/retro";
import type { TodoItem } from "@/types";

function Marker({ state }: { state: "done" | "next" | "open" }) {
  return (
    <span
      aria-hidden
      className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
        state === "done" ? "bg-ok-soft text-ok" : state === "next" ? "border-2 border-accent bg-accent-soft" : "border-2 border-input"
      }`}
    >
      {state === "done" ? "✓" : state === "next" ? <span className="size-2 rounded-full bg-accent" /> : null}
    </span>
  );
}

export function TodoCard({ items, children }: { items: TodoItem[]; children?: ReactNode }) {
  const left = items.filter((t) => !t.done).length;
  const next = items.find((t) => !t.done);
  return (
    <RetroCard title="To-do" action={<RetroBadge tone={left ? "warn" : "ok"}>{left ? `${left} left` : "All done"}</RetroBadge>}>
      <ul className="-mx-2 space-y-1">
        {items.map((t) => {
          const body = (
            <>
              <Marker state={t.done ? "done" : t === next ? "next" : "open"} />
              <span className="min-w-0 flex-1">
                <span className="sr-only">{t.done ? "Done: " : "To do: "}</span>
                <span className={`block ${t.done ? "text-ink-soft" : "font-semibold text-ink"}`}>{t.title}</span>
                {t.detail && <span className="block text-sm text-ink-soft">{t.detail}</span>}
              </span>
            </>
          );
          return (
            <li key={t.code}>
              {!t.done && t.href ? (
                <Link href={t.href} className="flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-panel-shade">
                  {body}
                  <span aria-hidden className="text-lg text-accent">
                    ›
                  </span>
                </Link>
              ) : (
                <div className="flex min-h-14 items-center gap-3 px-2 py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {children}
    </RetroCard>
  );
}
