import Link from "next/link";
import { PhotoImage } from "@/components/photos/PhotoImage";
import { RetroBadge, RetroCard, RetroLinkButton } from "@/components/retro";
import { CarDamageMap2D } from "@/components/vehicle/CarDamageMap2D";
import { componentLabel, type AggregatedDamage, type Severity } from "@/types";

const SEVERITY_TONE: Record<Severity, "neutral" | "warn" | "danger"> = { minor: "neutral", moderate: "warn", severe: "danger" };
const MAX_PARTS = 4;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Props = {
  vehicleId: string;
  damage: AggregatedDamage[];
  photos: { id: string; url: string }[];
  photoCount: number;
  analyzing: number;
  needsReview: boolean;
};

export function DamageCard({ vehicleId, damage, photos, photoCount, analyzing, needsReview }: Props) {
  return (
    <RetroCard
      title="Damage"
      action={
        needsReview ? (
          <RetroBadge tone="warn">Needs review</RetroBadge>
        ) : (
          damage.length > 0 && <RetroBadge tone="danger">{plural(damage.length, "damaged part")}</RetroBadge>
        )
      }
    >
      <div className="space-y-3">
        {damage.length > 0 ? (
          <div className="flex items-start gap-4">
            <CarDamageMap2D damage={damage} className="h-40 shrink-0" />
            <ul className="min-w-0 flex-1 space-y-2">
              {damage.slice(0, MAX_PARTS).map((d) => (
                <li key={d.component}>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-ink">{componentLabel(d.component)}</span>
                    <RetroBadge tone={SEVERITY_TONE[d.severity]}>{d.severity}</RetroBadge>
                  </p>
                  {d.damageTypes.length > 0 && (
                    <p className="text-xs text-ink-soft capitalize">{d.damageTypes.map((t) => t.replace(/_/g, " ")).join(", ")}</p>
                  )}
                </li>
              ))}
              {damage.length > MAX_PARTS && <li className="text-sm text-ink-soft">+{damage.length - MAX_PARTS} more</li>}
              {analyzing > 0 && <li className="text-sm text-ink-soft">Checking {plural(analyzing, "more photo")}…</li>}
            </ul>
          </div>
        ) : (
          <div>
            <p className="font-semibold">No damage recorded</p>
            <p className="text-sm text-ink-soft">
              {analyzing > 0
                ? `Checking ${plural(analyzing, "photo")}…`
                : photoCount > 0
                  ? `Nothing visible in ${plural(photoCount, "photo")}.`
                  : "Take photos if something happened to your car."}
            </p>
          </div>
        )}
        {photos.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">
              Latest of {plural(photoCount, "photo")}
              {damage.length > 0 && " showing damage"}
            </p>
            <Link href="/garage" aria-label="See your photos in the garage" className="grid grid-cols-4 gap-2">
              {photos.map((p) => (
                <PhotoImage key={p.id} vehicleId={vehicleId} photoId={p.id} src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </Link>
          </div>
        )}
        {needsReview && (
          <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-ink">Some photos were unclear. An adjuster may need to inspect the car.</p>
        )}
        <RetroLinkButton href="/garage" variant="secondary" className="w-full">
          {damage.length > 0 ? "See it on your car" : "Add photos"}
        </RetroLinkButton>
      </div>
    </RetroCard>
  );
}
