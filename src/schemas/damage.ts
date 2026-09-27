import { z } from "zod";
import { COMPONENT_IDS, DAMAGE_TYPES, SEVERITIES, VEHICLE_VIEWS, type PhotoIssue } from "@/types";

const Fraction = z.number().min(0).max(1);

export const BoxSchema = z.object({ xMin: Fraction, yMin: Fraction, xMax: Fraction, yMax: Fraction });

export const DamagedComponentSchema = z.object({
  component: z.enum(COMPONENT_IDS),
  damageTypes: z.array(z.enum(DAMAGE_TYPES)),
  severity: z.enum(SEVERITIES),
  confidence: z.number().min(0).max(1),
  description: z.string(),
  box: BoxSchema.optional(),
});

export const DamageAnalysisSchema = z.object({
  view: z.enum(VEHICLE_VIEWS),
  damagedComponents: z.array(
    DamagedComponentSchema.omit({ box: true }).extend({ box_2d: z.array(z.number().int().min(0).max(1000)).length(4).optional() }),
  ),
  summary: z.string(),
  needsManualReview: z.boolean(),
});
export type DamageAnalysis = Omit<z.infer<typeof DamageAnalysisSchema>, "damagedComponents"> & {
  damagedComponents: z.infer<typeof DamagedComponentSchema>[];
  photoIssues: PhotoIssue[];
};
