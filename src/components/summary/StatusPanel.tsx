import Link from "next/link";
import { Fragment } from "react";
import { RetroBadge, retroButtonClass } from "@/components/retro";
import type { IncidentStatus, IncidentType, TodoItem } from "@/types";
import { LocalTime } from "./LocalTime";

const COPY: Record<Exclude<IncidentStatus, "closed">, { title: string; detail: string; tone: "neutral" | "warn" | "ok" | "accent" }> = {
  documenting: { title: "Documenting", detail: "Take photos so we can check for damage.", tone: "neutral" },
  analyzing: { title: "Checking photos", detail: "We're looking for visible damage.", tone: "neutral" },
  action_required: { title: "Action needed", detail: "Finish the to-dos below to get ready to file.", tone: "warn" },
  ready_to_file: { title: "Ready to file", detail: "Everything's in place. Start your claim below.", tone: "ok" },
  filed: { title: "Claim filed", detail: "Close the incident once your insurer resolves it.", tone: "accent" },
};

type Incident = { status: IncidentStatus; type?: IncidentType | null; occurredAt?: Date | null; location?: string | null };

export function StatusPanel({ incident, items }: { incident: Incident | null; items: TodoItem[] }) {
  const copy = incident && incident.status !== "closed" ? COPY[incident.status] : null;
  const recap = copy
    ? [
        incident?.type && <span className="capitalize">{incident.type}</span>,
        incident?.occurredAt && <LocalTime iso={incident.occurredAt.toISOString()} withTime />,
        incident?.location,
      ].filter(Boolean)
    : [];
  const done = items.filter((t) => t.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const next = items.find((t) => !t.done);

  return (
    <section aria-label="Current Status" className="task-card">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">Current status</p>
          <RetroBadge tone={copy?.tone ?? "ok"}>{copy?.title ?? "All clear"}</RetroBadge>
        </div>
        <h2 className="mt-2 font-display text-xl font-semibold text-ink">{copy?.detail ?? "No open incident for this car."}</h2>
        {recap.length > 0 && (
          <p className="mt-1 text-sm text-ink-soft">
            <span className="font-semibold text-ink">What happened: </span>
            {recap.map((r, i) => (
              <Fragment key={i}>
                {i > 0 && " · "}
                {r}
              </Fragment>
            ))}
          </p>
        )}
        {copy && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3 text-sm font-semibold text-ink">
              <span>Claim steps</span>
              <span className="font-display tabular-nums">
                {done} / {items.length}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Claim steps done"
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={done}
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-panel-shade"
            >
              <span
                className={`block h-full rounded-full transition-[width] duration-300 ease-[steps(6,end)] ${pct === 100 ? "bg-ok" : "bg-accent"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
        {next && <p className="mt-2 text-sm text-ink-soft">Next: {next.title}</p>}
      </div>
      {next?.href && (
        <Link href={next.href} className={retroButtonClass("primary", "w-full sm:w-auto")}>
          Next step <span aria-hidden>→</span>
        </Link>
      )}
    </section>
  );
}
