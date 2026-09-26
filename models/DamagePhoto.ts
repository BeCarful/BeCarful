import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ANALYSIS_STATUSES, PHOTO_SOURCES } from "@/types";

// capturedAt / latitude / longitude come from the browser and are not verified evidence.
const DamagePhotoSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    incidentId: { type: Schema.Types.ObjectId, ref: "Incident", required: true, index: true },
    s3Key: { type: String, required: true },
    contentType: { type: String, required: true },
    source: { type: String, enum: PHOTO_SOURCES, required: true },
    capturedAt: { type: Date },
    serverReceivedAt: { type: Date, default: Date.now },
    latitude: { type: Number },
    longitude: { type: Number },
    locationAccuracy: { type: Number },
    sha256: { type: String },
    seal: { type: String },
    analysisStatus: { type: String, enum: ANALYSIS_STATUSES, default: "pending" },
  },
  { timestamps: true },
);
DamagePhotoSchema.index({ userId: 1, vehicleId: 1, createdAt: -1 });

export type DamagePhotoDoc = InferSchemaType<typeof DamagePhotoSchema>;
export const DamagePhoto: Model<DamagePhotoDoc> = models.DamagePhoto ?? model("DamagePhoto", DamagePhotoSchema);
