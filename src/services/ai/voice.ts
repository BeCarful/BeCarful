import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";

const API = "https://api.elevenlabs.io/v1";
const MAX_SPOKEN_CHARS = 1500;

export const MAX_SPEECH_BYTES = 900_000;

export const voiceEnabled = () => Boolean(env().ELEVENLABS_API_KEY);

function apiKey() {
  const key = env().ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
}

export function speechText(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "")
    .trim()
    .slice(0, MAX_SPOKEN_CHARS);
}

export async function transcribe(audio: Blob): Promise<string> {
  const body = new FormData();
  body.append("model_id", "scribe_v2");
  body.append("tag_audio_events", "false");
  body.append("file", audio, "speech");
  const res = await fetch(`${API}/speech-to-text`, { method: "POST", headers: { "xi-api-key": apiKey() }, body });
  if (!res.ok) throw new Error(`ElevenLabs speech-to-text ${res.status}: ${await res.text()}`);
  return z.object({ text: z.string() }).parse(await res.json()).text.trim();
}

export async function speak(text: string, voice: { id: string; speed: number }): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(voice.id)}/stream?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": apiKey(), "content-type": "application/json" },
    body: JSON.stringify({ text: speechText(text), model_id: "eleven_flash_v2_5", voice_settings: { speed: voice.speed } }),
  });
  if (!res.ok || !res.body) throw new Error(`ElevenLabs text-to-speech ${res.status}: ${await res.text()}`);
  return res.body;
}
