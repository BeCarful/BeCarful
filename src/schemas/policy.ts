import { z } from "zod";

// null = not found in the document. The UI renders null as NOT_FOUND_IN_POLICY; never guess.
const field = z.string().nullable();

export const PolicyExtractionSchema = z.object({
  provider: field,
  policyNumber: field,
  policyType: field,
  effectiveDates: field,
  premium: field,
  coveredVehicle: field,
  collision: field,
  comprehensive: field,
  liability: field,
  deductibles: field,
  rentalReimbursement: field,
  roadsideAssistance: field,
  otherCoverage: z.array(z.string()),
  exclusions: z.array(z.string()),
});
export type PolicyExtraction = z.infer<typeof PolicyExtractionSchema>;

export const PastedPolicyTextSchema = z.string().trim().min(200, "Paste the full policy or declarations page").max(60_000);
