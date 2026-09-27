import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CrashPhotos } from "@/components/crash/CrashPhotos";
import { PageHeader } from "@/components/layout/PageHeader";
import { Deadlines } from "@/components/summary/Deadlines";
import { RetroCard, RetroLinkButton, retroButtonClass } from "@/components/retro";
import { claimDeadlines } from "@/services/claims/deadlines";
import { loadClaimState } from "@/services/claims/state";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";

export const metadata: Metadata = { title: "Crash mode · BeCarful" };

export const maxDuration = 60;

const statute = (section: string) =>
  `http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0316/Sections/0316.${section}.html`;

const STEPS = [
  {
    title: "Anyone hurt? Call 911 now.",
    detail: "Do this before anything else, then help anyone injured get medical care.",
    law: "316.062",
  },
  {
    title: "Stay at the scene.",
    detail: "Don't leave until you've swapped info. If your car blocks traffic and can move safely, move it out of the lanes.",
    law: "316.061",
  },
  {
    title: "Call the police if anyone is hurt or damage looks like $2,000 or more.",
    detail: "Report it right away to the local police, the sheriff or the Florida Highway Patrol.",
    law: "316.065",
  },
  {
    title: "Swap info with the other driver.",
    detail: "Give your name, address and registration number. Show your license if asked.",
    law: "316.062",
  },
  {
    title: "No police report? File your own within 10 days.",
    detail: "Send a written crash report to the Florida DHSMV.",
    law: "316.066",
  },
];

export default async function CrashPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step } = await searchParams;

  if (step !== "photos") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Crash mode"
          title="Stay calm. Do this first."
          description="What Florida law asks of you after a crash, most urgent first."
        />
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`flex gap-4 p-4 ${i === 0 ? "rounded-xl border border-danger bg-danger-soft" : "surface-card"}`}>
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-semibold ${i === 0 ? "bg-danger text-white dark:text-[#1b0b0b]" : "bg-panel-shade text-ink"}`}
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="font-semibold">{s.title}</h2>
                <p className="text-sm text-ink-soft">{s.detail}</p>
                {i === 0 && (
                  <a href="tel:911" className={retroButtonClass("danger", "my-2 w-full sm:w-auto")}>
                    Call 911
                  </a>
                )}
                <a href={statute(s.law)} target="_blank" rel="noreferrer" className="block w-fit text-xs text-ink-soft underline">
                  Fla. Stat. § {s.law}
                </a>
              </div>
            </li>
          ))}
        </ol>
        <RetroLinkButton href="/crash?step=photos" className="w-full sm:w-auto">
          Next: photograph the damage <span aria-hidden>→</span>
        </RetroLinkButton>
      </div>
    );
  }

  const { user, vehicles, selected } = await getVehicleContext();
  if (!selected) redirect("/vehicles/new");
  const { incident, provider } = await loadClaimState(user._id, selected._id);
  const now = new Date().toISOString();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Crash mode"
        title="Photograph the damage"
        description="Pick the car you were driving, then take photos of every damaged side. Each photo is sealed with its time and location and added to your claim."
      />
      <RetroCard>
        <CrashPhotos vehicles={vehicles.map((v) => ({ id: v._id.toString(), title: vehicleTitle(v) }))} selectedId={selected._id.toString()} />
        <Deadlines
          deadlines={claimDeadlines({ type: incident?.type, providerId: provider?.id, providerName: provider?.name, filed: incident?.status === "filed" })}
          from={incident?.occurredAt?.toISOString() ?? now}
          now={now}
          estimated={!incident?.occurredAt}
        />
      </RetroCard>
      <div className="flex flex-wrap gap-3">
        <RetroLinkButton href="/crash" variant="ghost">
          <span aria-hidden>←</span> Safety steps
        </RetroLinkButton>
        <RetroLinkButton href="/" variant="secondary" className="ml-auto">
          Exit to home
        </RetroLinkButton>
      </div>
    </div>
  );
}
