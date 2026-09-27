import type { IncidentType } from "@/types";

export type Deadline = {
  id: string;
  title: string;
  detail: string;
  due: { days: number } | { hours: number } | null;
  source: { citation: string; url?: string };
};

const STATE_FARM_POLICY = "State Farm policy 9810C, Insured's Duties";

export function claimDeadlines(s: { type?: IncidentType | null; providerId?: string | null; providerName?: string | null; filed: boolean }): Deadline[] {
  const crash = !s.type || s.type === "collision";
  const stateFarm = s.providerId === "state-farm";
  const out: Deadline[] = [];

  if (!s.filed) {
    out.push(
      stateFarm
        ? {
            id: "NOTIFY_INSURER",
            title: "Tell State Farm what happened",
            detail: "Your policy says as soon as reasonably possible. It sets no number of days, so don't wait.",
            due: null,
            source: { citation: STATE_FARM_POLICY },
          }
        : {
            id: "NOTIFY_INSURER",
            title: `Tell ${s.providerName ?? "your insurer"} what happened`,
            detail: "Your policy sets how soon you have to report it, so don't wait.",
            due: null,
            source: { citation: "Check your policy's duties after an accident" },
          },
    );
  }
  if (crash && stateFarm) {
    out.push({
      id: "HIT_AND_RUN_POLICE",
      title: "Hit-and-run? Report it to the police",
      detail: "If the other driver and owner are unknown, State Farm needs a police report within 24 hours, or as soon as you reasonably can.",
      due: { hours: 24 },
      source: { citation: STATE_FARM_POLICY },
    });
  }
  if (crash) {
    out.push(
      {
        id: "CRASH_REPORT",
        title: "No police report? Send your own crash report",
        detail: "If police didn't write one, send a written report to the Florida DHSMV.",
        due: { days: 10 },
        source: { citation: "Fla. Stat. § 316.066(1)(e)", url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0316/Sections/0316.066.html" },
      },
      {
        id: "PIP_CARE",
        title: "Get any injury checked by a doctor",
        detail: "PIP pays medical bills only if care starts within 14 days of the crash. Some injuries show up later.",
        due: { days: 14 },
        source: { citation: "Fla. Stat. § 627.736(1)(a)", url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.736.html" },
      },
    );
  }
  if (crash && stateFarm) {
    out.push({
      id: "HIT_AND_RUN_INSURER",
      title: "Hit-and-run? Tell State Farm",
      detail: "Uninsured motor vehicle coverage needs you to report an unknown driver to State Farm within 30 days.",
      due: { days: 30 },
      source: { citation: STATE_FARM_POLICY },
    });
  }
  return out;
}

export function dueDate(from: Date, due: NonNullable<Deadline["due"]>): Date {
  if ("hours" in due) return new Date(from.getTime() + due.hours * 3_600_000);
  const d = new Date(from);
  d.setDate(d.getDate() + due.days);
  d.setHours(23, 59, 59, 999);
  return d;
}
