import { DEFAULT_PROVIDER_ID, PROVIDERS } from "@/services/insurance/providers";

export function ProviderPicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  return (
    <div role="group" aria-label="Choose your insurer" className="grid grid-cols-2 gap-3">
      {PROVIDERS.map((p) => {
        const on = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(p.id)}
            className={`relative flex min-h-16 items-center gap-2.5 rounded-xl border p-3 text-left transition disabled:opacity-50 ${on ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-border bg-panel hover:border-muted hover:bg-panel-shade"}`}
          >
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.shortName}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-tight font-semibold text-ink">{p.name}</span>
              {p.id === DEFAULT_PROVIDER_ID && <span className="mt-1 inline-block rounded-full bg-gold-soft px-2 text-[11px] font-semibold text-gold">Preferred</span>}
            </span>
            {on && (
              <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
