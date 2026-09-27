import type { PolicyExtraction } from "@/schemas/policy";
import { NOT_FOUND_IN_POLICY } from "@/types";

type Field = [keyof PolicyExtraction, string];

export const COVERAGE_FIELDS: Field[] = [
  ["collision", "Collision"],
  ["comprehensive", "Comprehensive"],
  ["deductibles", "Deductibles"],
  ["liability", "Liability"],
  ["rentalReimbursement", "Rental reimbursement"],
  ["roadsideAssistance", "Roadside assistance"],
  ["otherCoverage", "Other coverage"],
  ["exclusions", "Key exclusions & limits"],
];

export const DETAIL_FIELDS: Field[] = [
  ["provider", "Provider"],
  ["policyNumber", "Policy number"],
  ["policyType", "Policy type"],
  ["effectiveDates", "Effective dates"],
  ["premium", "Premium"],
  ["coveredVehicle", "Covered vehicle"],
];

export function PolicyFields({ data, fields }: { data: PolicyExtraction; fields: Field[] }) {
  return (
    <dl className="divide-y divide-border">
      {fields.map(([key, label]) => {
        const value = data[key];
        const missing = !value || value.length === 0;
        return (
          <div key={key} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-ink-soft">{label}</dt>
            <dd className={`text-[15px] leading-snug ${missing ? "text-muted" : "font-semibold text-ink tabular-nums"}`}>
              {missing ? (
                NOT_FOUND_IN_POLICY
              ) : Array.isArray(value) ? (
                <ul className="list-disc space-y-1 pl-5 font-normal marker:text-muted">
                  {value.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              ) : (
                value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
