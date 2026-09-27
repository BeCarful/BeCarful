import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { BrandMark } from "@/components/layout/Wordmark";
import { RetroBadge, RetroCard } from "@/components/retro";
import { LocalTime } from "@/components/summary/LocalTime";
import { DamageList } from "@/components/vehicle/SeverityBadge";
import { loadSharedEvidence } from "@/services/share/evidence";

export const metadata: Metadata = {
  title: "Shared evidence · BeCarful",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{children}</dd>
    </div>
  );
}

const missing = <span className="text-muted">Not given</span>;

export default async function SharedEvidencePage({ params }: PageProps<"/share/[token]">) {
  const evidence = await loadSharedEvidence((await params).token);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <BrandMark />
      {!evidence ? (
        <RetroCard title="This link doesn't work anymore">
          <p className="text-sm text-ink-soft">It expired or the sender stopped sharing it. Ask them for a new link.</p>
        </RetroCard>
      ) : (
        <>
          <PageHeader
            eyebrow="Shared evidence"
            title={evidence.vehicle.title}
            description={
              <>
                Shared by {evidence.sharedBy} through BeCarful. This link works until <LocalTime iso={evidence.expiresAt} withTime />.
              </>
            }
          />

          <div className="grid gap-6 sm:grid-cols-2">
            <RetroCard title="Incident">
              <dl className="divide-y divide-border text-sm">
                <Row label="What happened">{evidence.incident.type ? <span className="capitalize">{evidence.incident.type}</span> : missing}</Row>
                <Row label="When">{evidence.incident.occurredAt ? <LocalTime iso={evidence.incident.occurredAt} withTime /> : missing}</Row>
                <Row label="Where">{evidence.incident.location || missing}</Row>
                {evidence.incident.notes && <Row label="Notes">{evidence.incident.notes}</Row>}
              </dl>
            </RetroCard>

            <RetroCard title="Vehicle">
              <dl className="divide-y divide-border text-sm">
                <Row label="Car">{evidence.vehicle.title}</Row>
                <Row label="Color">{evidence.vehicle.color}</Row>
                <Row label="Plate">{evidence.vehicle.plate}</Row>
                {evidence.vehicle.vinLast4 && <Row label="VIN">Ending in {evidence.vehicle.vinLast4}</Row>}
              </dl>
            </RetroCard>
          </div>

          <RetroCard title="Damage" action={<RetroBadge tone="warn">AI estimate</RetroBadge>}>
            <p className="-mt-1 mb-3 text-sm text-ink-soft">Read from the photos by AI. Not an appraisal or repair estimate.</p>
            {evidence.damage.length > 0 ? <DamageList items={evidence.damage} /> : <p className="text-sm">No damage identified.</p>}
          </RetroCard>

          <RetroCard title={`Photos (${evidence.photos.length})`}>
            <ul className="grid gap-6 sm:grid-cols-2">
              {evidence.photos.map((p, i) => (
                <li key={p.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Photo ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full rounded-lg border border-border bg-panel-shade object-cover" />
                  <dl className="mt-3 divide-y divide-border text-sm">
                    <Row label={p.source === "camera" ? "Taken (phone clock)" : "Uploaded"}>
                      <LocalTime iso={p.capturedAt ?? p.receivedAt} withTime />
                    </Row>
                    <Row label="Received by BeCarful">
                      <LocalTime iso={p.receivedAt} withTime />
                    </Row>
                    <Row label="Location (phone GPS)">
                      {p.location
                        ? `${p.location.latitude.toFixed(5)}, ${p.location.longitude.toFixed(5)}${p.location.accuracy != null ? ` (±${Math.round(p.location.accuracy)} m)` : ""}`
                        : "Location unavailable"}
                    </Row>
                    {p.sha256 && (
                      <Row label="SHA-256">
                        <span className="font-mono text-xs break-all">{p.sha256}</span>
                      </Row>
                    )}
                  </dl>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-accent underline">
                    Open original
                  </a>
                </li>
              ))}
            </ul>
          </RetroCard>

          <p className="text-sm text-ink-soft">
            Photo times and locations come from the sender&apos;s phone and aren&apos;t independently verified. BeCarful recorded when it received
            each photo and its SHA-256 fingerprint. An original with the same fingerprint hasn&apos;t changed since BeCarful received it.
          </p>
        </>
      )}
    </main>
  );
}
