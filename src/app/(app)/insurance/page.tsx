import { redirect } from "next/navigation";
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
import { RetroBadge, RetroCard, RetroDialog, retroButtonClass } from "@/components/retro";
import type { InsurancePolicyDoc } from "@/models/InsurancePolicy";
import { PolicyExtractionSchema } from "@/schemas/policy";
import type { CoverageItem } from "@/services/ai/coverage-rules";
import { getActivePolicy } from "@/services/claims/state";
import { getProvider, isOfficialUrl } from "@/services/insurance/providers";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";

// Policy extraction runs inside this page's server actions.
export const maxDuration = 120;

const STATUS = {
  processed: { tone: "ok", label: "Ready" },
  processing: { tone: "warn", label: "Reading" },
  failed: { tone: "danger", label: "Failed" },
} as const;

export default async function InsurancePage() {
  const { user, selected } = await getVehicleContext();
  if (!selected) redirect("/vehicles/new");
  const vehicleId = String(selected._id);
  const policy = await getActivePolicy(user._id, selected._id);
  const provider = policy ? getProvider(policy.providerId) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insurance"
        title={policy ? provider ? <ProviderName provider={provider} /> : "Your policy" : "Add your insurance"}
        description={
          policy
            ? `${vehicleTitle(selected)}: what your policy covers, in plain words.`
            : "Pick your insurer and add your policy. We'll explain what it covers in plain words."
        }
        action={
          policy && (
            <a href={`/insurance/original?vehicleId=${vehicleId}`} target="_blank" rel="noopener" className={retroButtonClass("secondary")}>
              {policy.s3Key.endsWith(".txt") ? "View original" : "View PDF"}
            </a>
          )
        }
      />
      {policy ? <PolicyScreen vehicleId={vehicleId} policy={policy} assistant={assistantById(user.assistantId)} /> : <InsuranceSetup vehicleId={vehicleId} />}
    </div>
  );
}

function PolicyScreen({ vehicleId, policy, assistant }: { vehicleId: string; policy: HydratedDocument<InsurancePolicyDoc>; assistant: Assistant }) {
  const policyId = String(policy._id);
  const provider = getProvider(policy.providerId);
  const status = STATUS[policy.status] ?? STATUS.processing;
  const parsed = PolicyExtractionSchema.safeParse(policy.extractedData);
  const data = policy.status === "processed" && parsed.success ? parsed.data : null;
  const isText = policy.s3Key.endsWith(".txt");
  const checklist = (policy.coverageChecklist as { items?: CoverageItem[] } | null)?.items ?? null;

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
          <CoverageChecklist vehicleId={vehicleId} items={checklist} />
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
