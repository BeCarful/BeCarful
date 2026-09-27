import type { CoverageItem, StatuteRef } from "@/services/ai/coverage-rules";
import type { PolicyExtraction } from "@/schemas/policy";
import { NOT_FOUND_IN_POLICY, PERIL_LABELS, type IncidentType, type Peril, type PhotoSource } from "@/types";
import { MIN_DAMAGE_PHOTOS } from "./todos";

export type CheckStatus = "ok" | "warn" | "fail" | "info";
export type ClaimCheckItem = { id: string; status: CheckStatus; title: string; detail?: string; law?: StatuteRef | null };
export type ClaimVerdict = "supported" | "gaps" | "at_risk";

export type ClaimCheckInput = {
  incidentType: IncidentType | null;
  occurredAt: Date | null;
  policy: { extraction: PolicyExtraction | null; coverage: CoverageItem[] | null; examplePlan: boolean } | null;
  photos: { source: PhotoSource; capturedAt: Date | null; hasLocation: boolean; showsDamage: boolean }[];
  damagePhotos: number;
  unclearPhotos: number;
};

export const INCIDENT_PERIL: Record<IncidentType, Peril | null> = {
  collision: "collision",
  flood: "flood",
  theft: "theft",
  vandalism: "vandalism",
  hail: "storm",
  fire: "fire",
  weather: "storm",
  other: null,
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LATE_PHOTO_DAYS = 3;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The first two dates in a policy's "effective dates" text, in order of appearance. */
export function parsePolicyPeriod(text: string): [Date, Date] | null {
  const found: { at: number; date: Date }[] = [];
  const add = (at: number, y: number, m: number, d: number) => {
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) found.push({ at, date: new Date(Date.UTC(y, m - 1, d)) });
  };
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) add(m.index, +m[1], +m[2], +m[3]);
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) add(m.index, +m[3], +m[1], +m[2]);
  for (const m of text.matchAll(/\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    add(m.index, +m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  }
  const [a, b] = found.sort((x, y) => x.at - y.at).map((f) => f.date);
  return a && b ? [a, b] : null;
}

/** true / false, or null when the text has no readable period or the date is within a day of either end. */
export function policyActiveOn(text: string, when: Date): boolean | null {
  const period = parsePolicyPeriod(text);
  if (!period) return null;
  const [start, end] = period;
  const t = when.getTime();
  if (t > start.getTime() + DAY && t < end.getTime() - DAY) return true;
  if (t < start.getTime() - DAY || t > end.getTime() + DAY) return false;
  return null;
}

/** Deterministic check of the evidence and policy behind a claim. It flags gaps; it never predicts the insurer's decision. */
export function checkClaim(c: ClaimCheckInput): { verdict: ClaimVerdict; items: ClaimCheckItem[] } {
  const items: ClaimCheckItem[] = [];
  const x = c.policy?.extraction ?? null;
  const peril = c.incidentType ? INCIDENT_PERIL[c.incidentType] : null;

  if (!c.policy) {
    items.push({ id: "coverage", status: "fail", title: "No insurance policy on file", detail: "Add your policy so we can check what it covers." });
  } else if (!peril) {
    items.push({ id: "coverage", status: "warn", title: "We can't match this incident to a coverage", detail: "Pick what happened in Incident details." });
  } else {
    const row = c.policy.coverage?.find((i) => i.peril === peril);
    const label = PERIL_LABELS[peril];
    if (row?.status === "covered") items.push({ id: "coverage", status: "ok", title: `Covered: ${label}`, detail: row.detail, law: row.law });
    else if (row?.status === "not_covered") items.push({ id: "coverage", status: "fail", title: `Not covered: ${label}`, detail: row.detail, law: row.law });
    else items.push({ id: "coverage", status: "warn", title: `Coverage unclear: ${label}`, detail: row?.detail ?? NOT_FOUND_IN_POLICY, law: row?.law });
  }

  if (c.policy?.examplePlan) {
    items.push({ id: "example_plan", status: "warn", title: "Checked against an example plan", detail: "Upload your actual policy for a real check." });
  }

  if (c.policy) {
    const active = x?.effectiveDates && c.occurredAt ? policyActiveOn(x.effectiveDates, c.occurredAt) : null;
    items.push(
      active === true
        ? { id: "policy_dates", status: "ok", title: "Policy was active on the incident date", detail: x?.effectiveDates ?? undefined }
        : active === false
          ? { id: "policy_dates", status: "fail", title: "Incident date is outside your policy period", detail: `Policy period: ${x?.effectiveDates}. Check the incident date, or ask your insurer about renewal.` }
          : { id: "policy_dates", status: "warn", title: "Confirm your policy was active that day", detail: x?.effectiveDates ? `Policy period: ${x.effectiveDates}.` : NOT_FOUND_IN_POLICY },
    );
  }

  if (x) {
    items.push({
      id: "deductible",
      status: "info",
      title: `Deductible: ${x.deductibles ?? NOT_FOUND_IN_POLICY}`,
      detail: "You pay this part of the repair. If repairs cost less, the claim pays nothing.",
    });
  }

  items.push(
    c.damagePhotos >= MIN_DAMAGE_PHOTOS
      ? { id: "damage_photos", status: "ok", title: `${count(c.damagePhotos, "photo")} show the damage` }
      : { id: "damage_photos", status: "warn", title: `Only ${c.damagePhotos} of ${MIN_DAMAGE_PHOTOS} damage photos`, detail: "Add a wide shot and a close-up of each damaged part." },
  );

  const uploaded = c.photos.filter((p) => p.source === "upload").length;
  items.push(
    uploaded === 0
      ? { id: "live_photos", status: "ok", title: "All photos taken live in BeCarful", detail: "Each has a SHA-256 fingerprint recorded when BeCarful received it." }
      : { id: "live_photos", status: "warn", title: `${count(uploaded, "photo")} uploaded, not taken live`, detail: "Uploaded photos have no capture time or location. Retake them live if you can." },
  );

  const noLocation = c.photos.filter((p) => !p.hasLocation).length;
  items.push(
    noLocation === 0
      ? { id: "location", status: "ok", title: "Every photo has a location", detail: "From the phone's GPS." }
      : { id: "location", status: "warn", title: `${count(noLocation, "photo")} without a location`, detail: "If the car is still where it happened, turn on location and retake them." },
  );

  if (c.occurredAt) {
    const at = c.occurredAt.getTime();
    const timed = c.photos.flatMap((p) => (p.capturedAt ? [{ t: p.capturedAt.getTime(), damage: p.showsDamage }] : []));
    const before = timed.filter((p) => p.t < at - HOUR);
    const damagedBefore = before.filter((p) => p.damage).length;
    const damagedAfter = timed.filter((p) => p.damage && p.t >= at - HOUR);
    const late = damagedAfter.filter((p) => p.t > at + LATE_PHOTO_DAYS * DAY).length;
    if (damagedBefore > 0) {
      items.push({ id: "prior_damage", status: "warn", title: `${count(damagedBefore, "photo")} show damage before the incident time`, detail: "Insurers don't pay for damage that was already there. If the incident time is wrong, fix it in Incident details." });
    } else if (before.length > 0) {
      items.push({ id: "before_photos", status: "ok", title: "Before photos show the car undamaged", detail: "A dated record from before the incident." });
    }
    if (late > 0) {
      items.push({ id: "timing", status: "warn", title: `${count(late, "damage photo")} taken over ${LATE_PHOTO_DAYS} days later`, detail: "The insurer may ask whether all the damage is from this incident. Explain the gap in your notes." });
    } else if (damagedAfter.length > 0) {
      items.push({ id: "timing", status: "ok", title: `Damage photos taken within ${LATE_PHOTO_DAYS} days of the incident` });
    }
  }

  if (c.unclearPhotos > 0) {
    items.push({ id: "unclear", status: "warn", title: `${count(c.unclearPhotos, "photo")} unclear`, detail: "An adjuster may need to inspect the car. Retake them in good light." });
  }

  const verdict: ClaimVerdict = items.some((i) => i.status === "fail") ? "at_risk" : items.some((i) => i.status === "warn") ? "gaps" : "supported";
  return { verdict, items };
}
