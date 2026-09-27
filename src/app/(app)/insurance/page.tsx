import Link from "next/link";
import { redirect } from "next/navigation";
import { removePolicy } from "@/actions/insurance";
import type { HydratedDocument } from "mongoose";
import { ChangeProvider } from "@/components/insurance/ChangeProvider";
import { CoverageChecklist } from "@/components/insurance/CoverageChecklist";
import { InsuranceSetup } from "@/components/insurance/InsuranceSetup";
import { COVERAGE_FIELDS, DETAIL_FIELDS, PolicyFields } from "@/components/insurance/PolicyFields";
import { PolicyUpload } from "@/components/insurance/PolicyUpload";
import { ProviderMark, ProviderName } from "@/components/insurance/ProviderPicker";
import { assistantById, type Assistant } from "@/components/chat/assistants";
import { TuxemonAttribution, TuxemonAvatar } from "@/components/chat/TuxemonAssistant";
import { PageHeader } from "@/components/layout/PageHeader";
import { RemoveButton, RetroBadge, RetroCard, RetroDialog, retroButtonClass } from "@/components/retro";
import type { InsurancePolicyDoc } from "@/models/InsurancePolicy";
import { PolicyExtractionSchema } from "@/schemas/policy";
import { checklistOf } from "@/services/claims/policies";
import { getPolicies } from "@/services/claims/state";
import { getProvider, isOfficialUrl } from "@/services/insurance/providers";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";

// Policy extraction runs inside this page's server actions.
export const maxDuration = 120;

const STATUS = {
  processed: { tone: "ok", label: "Ready" },
  processing: { tone: "warn", label: "Reading" },
  failed: { tone: "danger", label: "Failed" },
} as const;

type Policy = HydratedDocument<InsurancePolicyDoc>;

export default async function InsurancePage({ searchParams }: { searchParams: Promise<{ policy?: string; add?: string }> }) {
  const { user, selected } = await getVehicleContext();
  if (!selected) redirect("/vehicles/new");
  const vehicleId = String(selected._id);
  const [params, policies] = await Promise.all([searchParams, getPolicies(user._id, selected._id)]);
  const policy = params.add === undefined ? (policies.find((p) => String(p._id) === params.policy) ?? policies[0]) : undefined;
  const provider = policy ? getProvider(policy.providerId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insurance"
        title={policy ? provider ? <ProviderName provider={provider} /> : "Your policy" : policies.length ? "Add another policy" : "Add your insurance"}
        description={
          policy
            ? `${vehicleTitle(selected)}: what this policy covers, in plain words.`
            : policies.length
              ? `${vehicleTitle(selected)} can have several active policies, like a car policy plus roadside or gap cover.`
              : "Pick your insurer and add your policy. We'll explain what it covers in plain words."
        }
        action={
          policy && (
            <a href={`/insurance/original?vehicleId=${vehicleId}&policyId=${policy._id}`} target="_blank" rel="noopener" className={retroButtonClass("secondary")}>
              {policy.s3Key.endsWith(".txt") ? "View original" : "View PDF"}
            </a>
          )
        }
      />
      {policies.length > 0 && <PolicyTabs policies={policies} currentId={policy ? String(policy._id) : null} />}
      {policy ? (
        <PolicyScreen key={String(policy._id)} vehicleId={vehicleId} policy={policy} assistant={assistantById(user.assistantId)} />
      ) : (
        <InsuranceSetup vehicleId={vehicleId} />
      )}
    </div>
  );
}

const tab = "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition";

function PolicyTabs({ policies, currentId }: { policies: Policy[]; currentId: string | null }) {
  return (
    <nav aria-label="Policies" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {policies.map((p) => {
        const id = String(p._id);
        const provider = getProvider(p.providerId);
        const shared = policies.some((o) => o !== p && o.providerId === p.providerId);
        const active = id === currentId;
        return (
          <Link
            key={id}
            href={`/insurance?policy=${id}`}
            aria-current={active ? "page" : undefined}
            className={`${tab} ${active ? "border-accent bg-accent-soft text-accent" : "border-border bg-panel text-ink hover:bg-panel-shade"}`}
          >
            {provider && <ProviderMark provider={provider} className="size-6 text-[9px]" />}
            <span className="max-w-48 truncate">
              {provider?.name ?? "Policy"}
              {shared && ` · ${p.fileName ?? "policy"}`}
            </span>
            {p.status !== "processed" && <RetroBadge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</RetroBadge>}
          </Link>
        );
      })}
      <Link href="/insurance?add=1" aria-current={currentId ? undefined : "page"} className={`${tab} ${currentId ? "border-dashed border-border text-accent hover:bg-panel-shade" : "border-accent bg-accent-soft text-accent"}`}>
        + Add policy
      </Link>
    </nav>
  );
}

function PolicyScreen({ vehicleId, policy, assistant }: { vehicleId: string; policy: Policy; assistant: Assistant }) {
  const policyId = String(policy._id);
  const provider = getProvider(policy.providerId);
  const status = STATUS[policy.status] ?? STATUS.processing;
  const parsed = PolicyExtractionSchema.safeParse(policy.extractedData);
  const data = policy.status === "processed" && parsed.success ? parsed.data : null;
  const isText = policy.s3Key.endsWith(".txt");
  const checklist = checklistOf(policy);

  return (
    // lg+: short cards side by side up top; the checklist and Coverage (both long) get the full width below.
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <RetroCard title="Your insurer">
            {provider ? (
              <>
                <div className="flex items-center gap-3">
                  <ProviderMark provider={provider} className="size-12 text-base" />
                  <div className="min-w-0">
                    <p className="text-lg leading-tight font-semibold">{provider.name}</p>
                    <p className="text-sm text-ink-soft tabular-nums">Claims line {provider.phone}</p>
                  </div>
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">
                  <span aria-hidden>✓</span> Official site: {provider.officialDomains[0]}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {isOfficialUrl(provider, provider.claimsUrl) && (
                    <a href={provider.claimsUrl} target="_blank" rel="noopener noreferrer" className={retroButtonClass("primary")}>
                      Start a claim ↗
                    </a>
                  )}
                  <a href={`tel:${provider.phone.replace(/[^\d+]/g, "")}`} className={retroButtonClass("secondary")}>
                    Call
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-soft">Pick your insurer so we can link you to their official claims page.</p>
            )}
            <div className="mt-3">
              <ChangeProvider vehicleId={vehicleId} policyId={policyId} providerId={policy.providerId} />
            </div>
          </RetroCard>

          <RetroCard title="Your policy" action={<RetroBadge tone={status.tone}>{status.label}</RetroBadge>}>
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent-soft font-display text-sm font-semibold text-accent">
                {isText ? "TXT" : "PDF"}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{policy.fileName ?? "Policy"}</p>
                {policy.uploadedAt && (
                  <p className="text-sm text-ink-soft">Added {policy.uploadedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</p>
                )}
              </div>
            </div>
            {policy.planId && (
              <p className="mt-4 rounded-lg bg-gold-soft px-3 py-2 text-sm text-ink">
                Example Florida plan, not your actual policy. Upload your policy for your exact coverage.
              </p>
            )}
            {policy.status !== "processed" && (
              <p role="status" className={`mt-4 rounded-lg px-3 py-2 text-sm text-ink ${policy.status === "failed" ? "bg-danger-soft" : "bg-warn-soft"}`}>
                {policy.status === "failed"
                  ? (policy.error ?? "We couldn't read this policy. Tap Retry, or upload a clearer copy.")
                  : "Still reading, or reading got interrupted. Tap Retry if this doesn't update."}
              </p>
            )}
            <div className="mt-4 space-y-3">
              <PolicyUpload
                vehicleId={vehicleId}
                providerId={policy.providerId}
                policyId={policyId}
                canRetry={policy.status !== "processed"}
                uploadLabel="Replace PDF"
              />
              <RemoveButton
                action={removePolicy.bind(null, vehicleId, policyId)}
                title={`${provider?.name ?? "this"} policy`}
                warning="Its file, summary and coverage check are deleted. Your other policies stay."
              />
            </div>
          </RetroCard>
        </div>

        {data && (
          <div className="space-y-6">
            {policy.aiSummary && (
              <RetroDialog speaker="In plain words" avatar={<TuxemonAvatar frame="front" scale={1} sheet={assistant.sheet} label={assistant.name} />}>
                <p>{policy.aiSummary}</p>
                <p className="mt-2 text-xs text-ink-soft">AI summary of what we found in your policy.</p>
                <TuxemonAttribution monsters={[assistant]} />
              </RetroDialog>
            )}
            <RetroCard title="Policy details">
              <PolicyFields data={data} fields={DETAIL_FIELDS} />
            </RetroCard>
          </div>
        )}
      </div>

      {data && (
        <>
          <CoverageChecklist vehicleId={vehicleId} policyId={policyId} items={checklist} />
          <RetroCard title="Coverage">
            <PolicyFields data={data} fields={COVERAGE_FIELDS} />
            <p className="mt-4 rounded-lg bg-panel-shade px-3 py-2 text-xs text-ink-soft">
              Read by AI from your policy. Your policy document is the final word.
            </p>
          </RetroCard>
        </>
      )}
    </div>
  );
}
