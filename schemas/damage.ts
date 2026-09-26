import { z } from "zod";
import { COMPONENT_IDS, DAMAGE_TYPES, SEVERITIES } from "@/types";

export const DamagedComponentSchema = z.object({
  component: z.enum(COMPONENT_IDS),
  damageTypes: z.array(z.enum(DAMAGE_TYPES)),
  severity: z.enum(SEVERITIES),
  confidence: z.number().min(0).max(1),
  description: z.string(),
});

export const DamageAnalysisSchema = z.object({
  damagedComponents: z.array(DamagedComponentSchema),
  summary: z.string(),
  needsManualReview: z.boolean(),
});
export type DamageAnalysis = z.infer<typeof DamageAnalysisSchema>;
