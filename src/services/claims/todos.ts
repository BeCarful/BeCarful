import type { AggregatedDamage, IncidentStatus, IncidentType, PolicyStatus, TodoItem } from "@/types";
import { SIDES, areaLabel, damagePhotoCount } from "./damage";

export const MIN_DAMAGE_PHOTOS = 3;

export type ClaimState = {
  policyStatus: PolicyStatus | null;
  providerName: string | null;
  photoCount: number;
  damage: AggregatedDamage[];
  incident: {
    type?: IncidentType | null;
    occurredAt?: Date | null;
    location?: string | null;
    status: IncidentStatus;
  } | null;
};

export type TodoList = { items: TodoItem[]; readyToFile: boolean; filed: boolean };

/**
 * Deterministic core claim steps. Order and membership are fixed here; AI may only reword.
 * Returns every applicable step with a done flag so the UI can render a checklist.
 */
export function computeTodos(s: ClaimState): TodoList {
  const items: TodoItem[] = [];
  const hasDamage = s.damage.length > 0;

  items.push({
    code: "UPLOAD_INSURANCE",
    title: s.policyStatus ? "Insurance policy uploaded" : "Add your insurance policy",
    done: s.policyStatus !== null,
    href: "/insurance",
  });
  if (s.policyStatus && s.policyStatus !== "processed") {
    items.push({
      code: "PROCESS_POLICY",
      title: s.policyStatus === "failed" ? "Re-upload your policy" : "Reading your policy…",
      detail: s.policyStatus === "failed" ? "We couldn't read that PDF. Try a clearer copy." : undefined,
      done: false,
      href: "/insurance",
    });
  }
  items.push({
    code: "ADD_PHOTOS",
    title: s.photoCount > 0 ? "Photos added" : "Take photos of your vehicle",
    done: s.photoCount > 0,
    href: "/garage",
  });

  if (hasDamage) {
    const shots = damagePhotoCount(s.damage);
    const enough = shots >= MIN_DAMAGE_PHOTOS;
    items.push({
      code: "ADD_DAMAGE_PHOTOS",
      title: enough ? "Damage documented from several angles" : `Add more photos of the damaged ${areaLabel(s.damage[0].component)}`,
      detail: enough ? undefined : `${shots} of ${MIN_DAMAGE_PHOTOS} photos. Try a wide shot and a close-up.`,
      done: enough,
      href: "/garage",
    });
    const i = s.incident;
    const infoDone = Boolean(i?.type && i.occurredAt && i.location);
    items.push({
      code: "COMPLETE_INCIDENT_INFO",
      title: infoDone ? "Incident details added" : "Add what happened, when and where",
      done: infoDone,
      href: "/summary#incident",
    });
    const filed = i?.status === "filed" || i?.status === "closed";
    items.push({
      code: "FILE_CLAIM",
      title: filed
        ? "Claim filed"
        : `File your claim${s.providerName ? ` with ${s.providerName}` : ""}`,
      done: filed,
      href: "/summary#claim",
    });
  }

  const core = items.filter((t) => t.code !== "FILE_CLAIM");
  const filed = items.some((t) => t.code === "FILE_CLAIM" && t.done);
  const readyToFile = hasDamage && s.policyStatus === "processed" && core.every((t) => t.done);
  return { items, readyToFile, filed };
}

/** Deterministic incident status. filed/closed are only set by explicit user actions. */
export function nextIncidentStatus(s: ClaimState, todos: TodoList): IncidentStatus | null {
  if (!s.incident) return null;
  if (s.incident.status === "filed" || s.incident.status === "closed") return s.incident.status;
  if (todos.readyToFile) return "ready_to_file";
  if (s.damage.length > 0) return "action_required";
  return "documenting";
}

export type Readiness = { insured: boolean; covered: boolean; documented: boolean; protected: boolean; openCase: boolean; missing: { label: string; href: string }[] };

/** Dashboard view of one car: insured, coverage checked, all sides photographed, and whether an incident is a real case. */
export function readiness(s: {
  policyStatus: PolicyStatus | null;
  coverageChecked: boolean;
  sides: number;
  damageCount: number;
  incident: { status: IncidentStatus } | null;
}): Readiness {
  const insured = s.policyStatus === "processed";
  const covered = insured && s.coverageChecked;
  const documented = s.sides >= SIDES.length;
  const missing = [
    !insured && { label: s.policyStatus ? "Finish your policy" : "Add insurance", href: "/insurance" },
    insured && !covered && { label: "Check coverage", href: "/insurance" },
    !documented && { label: "Photograph every side", href: "/garage" },
  ].filter((m): m is { label: string; href: string } => Boolean(m));
  const openCase = Boolean(s.incident && s.incident.status !== "closed" && (s.damageCount > 0 || s.incident.status !== "documenting"));
  return { insured, covered, documented, protected: covered && documented, openCase, missing };
}
