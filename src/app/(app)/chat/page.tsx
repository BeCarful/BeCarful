import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatThread } from "@/components/chat/ChatThread";
import { recentMessages } from "@/services/ai/chat";
import { getVehicleContext, vehicleTitle } from "@/services/vehicles/context";

export const metadata: Metadata = { title: "Chat · BeCarful" };
export const maxDuration = 60;

export default async function ChatPage() {
  const { user, selected } = await getVehicleContext();
  if (!selected) redirect("/vehicles/new");
  const vehicleId = selected._id.toString();
  const messages = await recentMessages(user._id, selected._id, 100);
  return <ChatThread key={vehicleId} vehicleId={vehicleId} vehicleName={vehicleTitle(selected)} initialMessages={messages} />;
}
