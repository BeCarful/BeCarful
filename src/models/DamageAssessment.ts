import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COMPONENT_IDS, DAMAGE_TYPES, SEVERITIES } from "@/types";

const DamagedComponentSchema = new Schema(
  {
    component: { type: String, enum: COMPONENT_IDS, required: true },
    damageTypes: [{ type: String, enum: DAMAGE_TYPES }],
    severity: { type: String, enum: SEVERITIES, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    description: { type: String, default: "" },
  },
  { _id: false },
);

// One assessment per analyzed photo.
const DamageAssessmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true, index: true },
    photoId: { type: Schema.Types.ObjectId, ref: "DamagePhoto", required: true, unique: true },
    damagedComponents: { type: [DamagedComponentSchema], default: [] },
    summary: { type: String, default: "" },
    needsManualReview: { type: Boolean, default: false },
    aiModel: { type: String },
  },
  { timestamps: true },
);
DamageAssessmentSchema.index({ userId: 1, vehicleId: 1 });

export type DamageAssessmentDoc = InferSchemaType<typeof DamageAssessmentSchema>;
export const DamageAssessment: Model<DamageAssessmentDoc> =
  models.DamageAssessment ?? model("DamageAssessment", DamageAssessmentSchema);
