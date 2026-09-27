import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COMPONENT_IDS, DAMAGE_TYPES, PHOTO_ISSUES, SEVERITIES, VEHICLE_VIEWS } from "@/types";

const BoxSchema = new Schema(
  {
    xMin: { type: Number, min: 0, max: 1, required: true },
    yMin: { type: Number, min: 0, max: 1, required: true },
    xMax: { type: Number, min: 0, max: 1, required: true },
    yMax: { type: Number, min: 0, max: 1, required: true },
  },
  { _id: false },
);

const DamagedComponentSchema = new Schema(
  {
    component: { type: String, enum: COMPONENT_IDS, required: true },
    damageTypes: [{ type: String, enum: DAMAGE_TYPES }],
    severity: { type: String, enum: SEVERITIES, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    description: { type: String, default: "" },
    box: { type: BoxSchema },
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
    view: { type: String, enum: VEHICLE_VIEWS, default: "unknown" },
    damagedComponents: { type: [DamagedComponentSchema], default: [] },
    summary: { type: String, default: "" },
    needsManualReview: { type: Boolean, default: false },
    photoIssues: { type: [{ type: String, enum: PHOTO_ISSUES }], default: [] },
    aiModel: { type: String },
  },
  { timestamps: true },
);
DamageAssessmentSchema.index({ userId: 1, vehicleId: 1 });

export type DamageAssessmentDoc = InferSchemaType<typeof DamageAssessmentSchema>;
export const DamageAssessment: Model<DamageAssessmentDoc> =
  models.DamageAssessment ?? model("DamageAssessment", DamageAssessmentSchema);
