import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat/ChatThread";
import { chatSubjects, recentMessages } from "@/services/ai/chat";
import { voiceEnabled } from "@/services/ai/voice";
import { getVehicleContext } from "@/services/vehicles/context";

export const metadata: Metadata = { title: "Chat · BeCarful" };

export default async function ChatPage() {
  const { user, selected } = await getVehicleContext();
  if (!selected) redirect("/vehicles/new");
  const [messages, subjects] = await Promise.all([recentMessages(user._id, selected._id, 100), chatSubjects(user._id)]);
  return <Chat vehicleId={selected._id.toString()} messages={messages} subjects={subjects} voice={voiceEnabled()} />;
}
