/** Retro step sequence: one pixel block per step; done steps get a check, the current one blinks. */
export function PixelProgress({ steps, current, failed = false }: { steps: string[]; current: number; failed?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-hidden>
        {steps.map((s, i) => (
          <span
            key={s}
            className={`h-2.5 rounded-[3px] ${i < current ? "bg-ok" : i === current ? (failed ? "bg-danger" : "animate-pulse bg-accent") : "bg-panel-shade"}`}
          />
        ))}
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-2 text-sm ${i < current ? "text-ok" : i === current ? (failed ? "font-semibold text-danger" : "font-semibold text-ink") : "text-muted"}`}
          >
            <span aria-hidden className="w-4 text-center font-display">
              {i < current ? "✓" : i === current ? (failed ? "✕" : "▶") : "·"}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
