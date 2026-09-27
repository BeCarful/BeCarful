import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const VehicleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    modelId: { type: String },
    nickname: { type: String, trim: true },
    year: { type: Number, required: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    trim: { type: String, trim: true },
    color: { type: String, required: true, trim: true },
    vin: { type: String, trim: true, uppercase: true },
    licensePlate: { type: String, required: true, trim: true, uppercase: true },
    state: { type: String, required: true, trim: true, uppercase: true },
  },
  { timestamps: true },
);

export type VehicleDoc = InferSchemaType<typeof VehicleSchema>;
export const Vehicle: Model<VehicleDoc> = models.Vehicle ?? model("Vehicle", VehicleSchema);
