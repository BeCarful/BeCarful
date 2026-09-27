import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProviderName } from "@/components/insurance/ProviderPicker";
import { PageHeader } from "@/components/layout/PageHeader";
import { OpenCar } from "@/components/layout/VehicleSelector";
import { RetroBadge, RetroCard, retroButtonClass } from "@/components/retro";
import { LocalTime } from "@/components/summary/LocalTime";
import { STATUS_COPY } from "@/components/summary/StatusPanel";
import { SIDES, documentedSides } from "@/services/claims/damage";
import { combinedCoverage } from "@/services/claims/policies";
import { loadClaimState } from "@/services/claims/state";
import { readiness } from "@/services/claims/todos";
import { getProvider, type InsuranceProvider } from "@/services/insurance/providers";
import { getVehicleContext, vehicleModel, vehicleTitle } from "@/services/vehicles/context";
import type { DamagedComponent } from "@/types";

export const metadata: Metadata = { title: "Dashboard · BeCarful" };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Stat({ label, value, of, tone }: { label: string; value: number; of?: number; tone: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-semibold text-ink-soft">{label}</p>
      <p className={`mt-1 font-display text-3xl leading-none font-semibold tabular-nums ${tone}`}>
        {value}
        {of !== undefined && <span className="text-lg text-ink-soft"> / {of}</span>}
      </p>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ok ? "bg-ok text-white" : "border-2 border-input"}`}
      >
        {ok && "✓"}
      </span>
      <span className="sr-only">{ok ? "Done: " : "Missing: "}</span>
      <span className={ok ? "text-ink" : "text-ink-soft"}>{children}</span>
    </li>
  );
}

export default async function DashboardPage() {
  const { user, vehicles, selected } = await getVehicleContext();
  if (!vehicles.length) redirect("/vehicles/new");

  const cars = await Promise.all(
    vehicles.map(async (v) => {
      const claim = await loadClaimState(user._id, v._id);
      const sides = documentedSides(
        claim.assessments.map((a) => ({ view: a.view, damagedComponents: a.damagedComponents as DamagedComponent[] })),
      );
      const insurers = [...new Map(claim.policies.flatMap((p) => (getProvider(p.providerId) ? [[p.providerId, getProvider(p.providerId)!] as const] : []))).values()];
      return {
        id: v._id.toString(),
        name: vehicleTitle(v),
        model: v.nickname ? vehicleModel(v) : null,
        plate: `${v.licensePlate} (${v.state})`,
        selected: Boolean(selected?._id.equals(v._id)),
        insurers: insurers as InsuranceProvider[],
        sides: sides.length,
        claim,
        ready: readiness({
          policyStatus: claim.state.policyStatus,
          coverageChecked: combinedCoverage(claim.policies) !== null,
          sides: sides.length,
          damageCount: claim.damage.length,
          incident: claim.incident,
        }),
      };
    }),
  );
  const cases = cars.filter((c) => c.ready.openCase);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Dashboard" title={`Hi, ${user.name.split(" ")[0]}`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cars" value={cars.length} tone="text-ink" />
        <Stat label="Insured" value={cars.filter((c) => c.ready.insured).length} of={cars.length} tone="text-accent" />
        <Stat label="Protected" value={cars.filter((c) => c.ready.protected).length} of={cars.length} tone="text-ok" />
        <Stat label="Open cases" value={cases.length} tone={cases.length ? "text-danger" : "text-ink"} />
      </div>

      {cases.length > 0 && (
        <RetroCard title="Open cases" action={<RetroBadge tone="danger">{cases.length}</RetroBadge>}>
          <ul className="divide-y divide-border">
            {cases.map((c) => {
              const { incident, damage, provider } = c.claim;
              if (!incident || incident.status === "closed") return null;
              const status = STATUS_COPY[incident.status];
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{c.name}</span>
                      <RetroBadge tone={status.tone}>{status.title}</RetroBadge>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      <span className="capitalize">{incident.type ?? "Incident"}</span>
                      {incident.occurredAt && (
                        <>
                          {" · "}
                          <LocalTime iso={incident.occurredAt.toISOString()} />
                        </>
                      )}
                      {" · "}
                      {plural(damage.length, "damaged part")}
                      {provider && <> · {provider.name}</>}
                    </p>
                  </div>
                  <OpenCar id={c.id} href="/summary" selected={c.selected} className={retroButtonClass("primary", "w-full sm:w-auto")}>
                    Open case <span aria-hidden>→</span>
                  </OpenCar>
                </li>
              );
            })}
          </ul>
        </RetroCard>
      )}

      <section aria-labelledby="cars-title" className="space-y-3">
        <h2 id="cars-title" className="section-title">
          Your cars
        </h2>
        <div className="@container">
          <ul className="grid gap-4 @xl:grid-cols-2">
            {cars.map((c) => (
              <li key={c.id} className="surface-card flex min-w-0 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg leading-tight font-semibold text-ink">{c.name}</p>
                    <p className="truncate text-sm text-ink-soft">{[c.model, c.plate].filter(Boolean).join(" · ")}</p>
                  </div>
                  {c.ready.openCase ? (
                    <RetroBadge tone="danger">Open case</RetroBadge>
                  ) : c.ready.protected ? (
                    <RetroBadge tone="ok">Protected</RetroBadge>
                  ) : c.ready.insured ? (
                    <RetroBadge tone="accent">Insured</RetroBadge>
                  ) : (
                    <RetroBadge tone="warn">Not insured</RetroBadge>
                  )}
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {c.insurers.length ? (
                    c.insurers.map((i) => (
                      <span key={i.id} className="font-medium text-ink">
                        <ProviderName provider={i} />
                      </span>
                    ))
                  ) : (
                    <span className="text-ink-soft">No insurance on file</span>
                  )}
                </p>
                <ul className="space-y-1.5">
                  <Check ok={c.ready.insured}>{c.claim.policies.length > 1 ? `${c.claim.policies.length} policies on file` : "Policy on file"}</Check>
                  <Check ok={c.ready.covered}>Coverage checked</Check>
                  <Check ok={c.ready.documented}>
                    Every side photographed ({c.sides}/{SIDES.length})
                  </Check>
                </ul>
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <OpenCar id={c.id} href="/summary" selected={c.selected} className={retroButtonClass("secondary", "flex-1")}>
                    Summary
                  </OpenCar>
                  {c.ready.missing[0] && (
                    <OpenCar id={c.id} href={c.ready.missing[0].href} selected={c.selected} className={retroButtonClass("primary", "flex-1")}>
                      {c.ready.missing[0].label}
                    </OpenCar>
                  )}
                </div>
              </li>
            ))}
            <li>
              <Link
                href="/vehicles/new"
                className="flex h-full min-h-40 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border p-5 font-semibold text-accent transition hover:bg-panel-shade"
              >
                <span aria-hidden className="text-3xl leading-none">
                  +
                </span>
                Add a car
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
