import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { JURISDICTIONS } from "@/types";

const StatuteSchema = new Schema({
  citation: { type: String, required: true },
  url: { type: String, required: true },
  jurisdiction: { type: String, enum: JURISDICTIONS, required: true },
  text: { type: String, required: true },
});

export type StatuteDoc = InferSchemaType<typeof StatuteSchema>;
export const Statute: Model<StatuteDoc> = models.Statute ?? model("Statute", StatuteSchema);
