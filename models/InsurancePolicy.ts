import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { POLICY_STATUSES } from "@/types";

// Latest uploadedAt per vehicle is the active policy; older ones are kept as history.
const InsurancePolicySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    providerId: { type: String, required: true },
    s3Key: { type: String, required: true },
    fileName: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    status: { type: String, enum: POLICY_STATUSES, default: "processing" },
    extractedData: { type: Schema.Types.Mixed, default: null },
    aiSummary: { type: String, default: null },
    // { items: CoverageItem[] } from the coverage agent; null until it has run.
    coverageChecklist: { type: Schema.Types.Mixed, default: null },
    // Set when the user picked a catalog plan (services/insurance/florida-plans.ts) instead of uploading their policy.
    planId: { type: String },
    error: { type: String },
  },
  { timestamps: true },
);
InsurancePolicySchema.index({ userId: 1, vehicleId: 1, uploadedAt: -1 });

export type InsurancePolicyDoc = InferSchemaType<typeof InsurancePolicySchema>;
export const InsurancePolicy: Model<InsurancePolicyDoc> =
  models.InsurancePolicy ?? model("InsurancePolicy", InsurancePolicySchema);
