import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { INCIDENT_STATUSES, INCIDENT_TYPES } from "@/types";

const IncidentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    insurancePolicyId: { type: Schema.Types.ObjectId, ref: "InsurancePolicy" },
    type: { type: String, enum: INCIDENT_TYPES },
    occurredAt: { type: Date },
    location: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: INCIDENT_STATUSES, default: "documenting" },
    filedAt: { type: Date },
  },
  { timestamps: true },
);
IncidentSchema.index({ userId: 1, vehicleId: 1, createdAt: -1 });

export type IncidentDoc = InferSchemaType<typeof IncidentSchema>;
export const Incident: Model<IncidentDoc> = models.Incident ?? model("Incident", IncidentSchema);
