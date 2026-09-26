import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// One continuous thread per { userId, vehicleId }.
const ChatMessageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true },
);
ChatMessageSchema.index({ userId: 1, vehicleId: 1, createdAt: 1 });

export type ChatMessageDoc = InferSchemaType<typeof ChatMessageSchema>;
export const ChatMessage: Model<ChatMessageDoc> = models.ChatMessage ?? model("ChatMessage", ChatMessageSchema);
