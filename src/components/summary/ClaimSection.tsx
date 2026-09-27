import type { ReactNode } from "react";
import { closeIncident, markClaimFiled } from "@/actions/incidents";
import { RetroCard, RetroLinkButton, retroButtonClass } from "@/components/retro";
import type { TodoList } from "@/services/claims/todos";
import { isOfficialUrl, type InsuranceProvider } from "@/services/insurance/providers";
import type { IncidentStatus } from "@/types";
import { ActionButton } from "./ActionButton";
import { LocalTime } from "./LocalTime";

type Props = {
  vehicleId: string;
  todos: TodoList;
  provider?: InsuranceProvider;
  policyNumber?: string | null;
  photoCount: number;
  incident: {
    status: IncidentStatus;
    type?: string | null;
    occurredAt?: Date | null;
    location?: string | null;
    filedAt?: Date | null;
  } | null;
};

function CallButton({ provider }: { provider: InsuranceProvider }) {
  return (
    <a href={`tel:${provider.phone.replace(/[^\d+]/g, "")}`} className={retroButtonClass("secondary", "w-full")}>
      Call {provider.phone}
    </a>
  );
}

export function ClaimSection({ vehicleId, todos, provider, policyNumber, photoCount, incident }: Props) {
  let body: ReactNode;

  if (incident?.status === "filed") {
    body = (
      <>
        <p className="flex items-center gap-2 rounded-lg bg-ok-soft px-3 py-2.5 font-semibold text-ok">
          <span aria-hidden>✓</span>
          <span>
            Claim filed{incident.filedAt && <> on <LocalTime iso={incident.filedAt.toISOString()} /></>}.
          </span>
        </p>
        <p className="text-sm text-ink-soft">Close this incident once your claim is resolved. New photos after that start a fresh incident.</p>
        {provider && <CallButton provider={provider} />}
        <ActionButton action={closeIncident.bind(null, vehicleId)} variant="secondary">
          Close incident
        </ActionButton>
      </>
    );
  } else if (!provider) {
    body = (
      <>
        <p className="text-sm text-ink-soft">Add your insurance policy first so we can send you to your insurer&apos;s official claim page.</p>
        <RetroLinkButton href="/insurance" className="w-full">
          Add your insurance
        </RetroLinkButton>
      </>
    );
  } else if (todos.readyToFile) {
    body = (
      <>
        <ul className="space-y-2 text-sm">
          {todos.items
            .filter((t) => t.code !== "FILE_CLAIM")
            .map((t) => (
              <li key={t.code} className="flex items-center gap-2.5">
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-ok-soft text-xs font-bold text-ok">
                  ✓
                </span>
                {t.title}
              </li>
            ))}
        </ul>
        <p className="border-t border-border pt-4 font-display text-lg font-semibold text-ink">File your claim with {provider.name}</p>
        <div className="grid gap-3">
          {isOfficialUrl(provider, provider.claimsUrl) && (
            <a href={provider.claimsUrl} target="_blank" rel="noopener noreferrer" className={retroButtonClass("primary", "w-full")}>
              Start Claim <span aria-hidden>↗</span>
              <span className="sr-only">(opens {provider.name} in a new tab)</span>
            </a>
          )}
          <CallButton provider={provider} />
        </div>
        <div className="rounded-lg bg-panel-shade p-4">
          <p className="mb-2 text-sm font-semibold text-ink">Have ready</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-soft marker:text-muted">
            {policyNumber && <li>Policy number: {policyNumber}</li>}
            {incident?.type && <li className="capitalize">{incident.type}</li>}
            {incident?.occurredAt && (
              <li>
                <LocalTime iso={incident.occurredAt.toISOString()} withTime />
              </li>
            )}
            {incident?.location && <li>{incident.location}</li>}
            <li>
              {photoCount} {photoCount === 1 ? "photo" : "photos"} of the damage
            </li>
          </ul>
        </div>
        <ActionButton action={markClaimFiled.bind(null, vehicleId)} variant="secondary">
          I&apos;ve filed my claim
        </ActionButton>
      </>
    );
  } else {
    const missing = todos.items.filter((t) => !t.done && t.code !== "FILE_CLAIM");
    body = (
      <>
        <p className="text-sm text-ink-soft">Before you file with {provider.name}:</p>
        <ul className="space-y-2 text-sm">
          {missing.map((t) => (
            <li key={t.code} className="flex items-center gap-2.5 font-semibold text-ink">
              <span aria-hidden className="size-6 shrink-0 rounded-full border-2 border-input" />
              {t.title}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <RetroCard id="claim" title="Your claim" className="scroll-mt-24">
      <div className="space-y-4">{body}</div>
    </RetroCard>
  );
}
