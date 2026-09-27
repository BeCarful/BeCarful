import Image from "next/image";
import { DEFAULT_PROVIDER_ID, PROVIDERS, type InsuranceProvider } from "@/services/insurance/providers";

export function ProviderMark({ provider, className }: { provider: InsuranceProvider; className: string }) {
  if (provider.logo)
    return (
      <span aria-hidden className={`shrink-0 overflow-hidden rounded-[22%] border border-border bg-white ${className}`}>
        <Image src={provider.logo} alt="" width={96} height={96} className="size-full object-cover" />
      </span>
    );
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[22%] font-display font-semibold text-white ${className}`}
      style={{ backgroundColor: provider.color }}
    >
      {provider.shortName}
    </span>
  );
}

export function ProviderName({ provider }: { provider: InsuranceProvider }) {
  return (
    <span className="inline-flex items-center gap-[0.35em] align-bottom whitespace-nowrap">
      <ProviderMark provider={provider} className="size-[1.3em] text-[0.5em]" />
      {provider.name}
    </span>
  );
}

export function WithProviderLogo({ text, provider }: { text: string; provider?: InsuranceProvider | null }) {
  if (!provider || !text.includes(provider.name)) return text;
  return text.split(provider.name).flatMap((part, i) => (i ? [<ProviderName key={i} provider={provider} />, part] : [part]));
}

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
            <ProviderMark provider={p} className="size-10 text-sm" />
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
