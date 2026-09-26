import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { CHAT_ACTION_STATUSES } from "@/types";

// One continuous thread per { userId, vehicleId }.
const ChatMessageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    // A write the agent proposed; runs only when the user taps Confirm (see services/ai/guard.ts).
    action: {
      type: new Schema(
        {
          tool: { type: String, required: true },
          args: { type: Schema.Types.Mixed, default: {} },
          label: { type: String, required: true },
          status: { type: String, enum: CHAT_ACTION_STATUSES, default: "pending" },
          result: { type: String },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);
ChatMessageSchema.index({ userId: 1, vehicleId: 1, createdAt: 1 });

export type ChatMessageDoc = InferSchemaType<typeof ChatMessageSchema>;
export const ChatMessage: Model<ChatMessageDoc> = models.ChatMessage ?? model("ChatMessage", ChatMessageSchema);
