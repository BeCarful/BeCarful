"use client";

import Link from "next/link";
import { RetroBadge } from "@/components/retro";
import { dueDate, type Deadline } from "@/services/claims/deadlines";
import { LocalTime, useIsClient } from "./LocalTime";

const DAY = 86_400_000;

function When({ from, now, due }: { from: string; now: string; due: Deadline["due"] }) {
  const isClient = useIsClient();
  if (!due) return <RetroBadge tone="danger">Now</RetroBadge>;
  if (!isClient) return null;
  const end = dueDate(new Date(from), due);
  const left = end.getTime() - new Date(now).getTime();
  const opts: Intl.DateTimeFormatOptions = "hours" in due ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric" };
  const label = end.toLocaleString(undefined, opts);
  if (left < 0) return <RetroBadge>Passed {label}</RetroBadge>;
  const days = Math.floor(left / DAY);
  return (
    <RetroBadge tone={days < 3 ? "danger" : "warn"}>
      By {label}
      {"days" in due && <span className="font-normal">· {days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} left`}</span>}
    </RetroBadge>
  );
}

export function Deadlines({ deadlines, from, now, estimated, detailsHref }: { deadlines: Deadline[]; from: string; now: string; estimated: boolean; detailsHref?: string }) {
  if (!deadlines.length) return null;
  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div>
        <h3 className="font-semibold text-ink">Deadlines</h3>
        <p className="text-sm text-ink-soft">
          {estimated ? "Counting from " : "Counting from the crash on "}
          <LocalTime iso={from} withTime={!estimated} />.{" "}
          {estimated &&
            (detailsHref ? (
              <>
                <Link href={detailsHref} className="font-semibold text-accent underline">
                  Add when it happened
                </Link>{" "}
                for exact dates.
              </>
            ) : (
              "Add when it happened on your Summary for exact dates."
            ))}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {deadlines.map((d) => (
          <li key={d.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
            <When from={from} now={now} due={d.due} />
            <p className="font-semibold text-ink">{d.title}</p>
            <p className="text-sm text-ink-soft">{d.detail}</p>
            {d.source.url ? (
              <a href={d.source.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-ink-soft underline">
                {d.source.citation}
              </a>
            ) : (
              <p className="text-xs text-ink-soft">{d.source.citation}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
