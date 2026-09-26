"use client";

import { useState, type ReactNode } from "react";
import { DEFAULT_PROVIDER_ID } from "@/services/insurance/providers";
import { FloridaPlanPicker } from "./FloridaPlanPicker";
import { PolicyUpload } from "./PolicyUpload";
import { ProviderPicker } from "./ProviderPicker";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="surface-card p-5">
      <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg font-semibold text-ink">
        <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm text-accent">
          {n}
        </span>
        <span className="sr-only">{n}. </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function InsuranceSetup({ vehicleId }: { vehicleId: string }) {
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER_ID);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Step n={1} title="Your insurer">
        <ProviderPicker value={providerId} onChange={setProviderId} />
      </Step>
      <Step n={2} title="Your policy">
        <p className="mb-4 text-sm text-ink-soft">
          Upload your policy or declarations page (PDF, up to 20 MB). We&apos;ll pull out what it covers.
        </p>
        <PolicyUpload vehicleId={vehicleId} providerId={providerId} uploadLabel="Upload policy PDF" />
        <details className="mt-4 rounded-xl border border-border bg-panel-shade/60 p-4 [&[open]>summary]:mb-3">
          <summary className="min-h-11 cursor-pointer content-center font-semibold text-accent">No policy on hand? Pick your Florida plan</summary>
          <FloridaPlanPicker key={providerId} vehicleId={vehicleId} providerId={providerId} />
        </details>
      </Step>
    </div>
  );
}
