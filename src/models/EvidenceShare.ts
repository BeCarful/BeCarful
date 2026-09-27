import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const EvidenceShareSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true },
    tokenHash: { type: String, required: true, unique: true },
    label: { type: String, trim: true },
    expiresAt: { type: Date, required: true },
    openCount: { type: Number, default: 0 },
    lastOpenedAt: { type: Date },
  },
  { timestamps: true },
);
EvidenceShareSchema.index({ userId: 1, vehicleId: 1, createdAt: -1 });
EvidenceShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EvidenceShareDoc = InferSchemaType<typeof EvidenceShareSchema>;
export const EvidenceShare: Model<EvidenceShareDoc> = models.EvidenceShare ?? model("EvidenceShare", EvidenceShareSchema);
