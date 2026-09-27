import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { POLICY_PRODUCTS } from "@/types";

const PolicyFormSchema = new Schema({
  providerId: { type: String, required: true },
  product: { type: String, enum: POLICY_PRODUCTS, required: true },
  form: { type: String, required: true },
  citation: { type: String, required: true },
  section: { type: String, required: true },
  term: { type: String },
  source: { type: String, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], default: undefined },
});

export type PolicyFormDoc = InferSchemaType<typeof PolicyFormSchema>;
export const PolicyForm: Model<PolicyFormDoc> = models.PolicyForm ?? model("PolicyForm", PolicyFormSchema);
