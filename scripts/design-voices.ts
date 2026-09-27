import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ASSISTANTS, assistantById } from "@/components/chat/assistants";

const API = "https://api.elevenlabs.io/v1";
const OUT = join(tmpdir(), "becarful-voice-design");
const MANIFEST = join(OUT, "previews.json");

const LOOKS: Record<string, string> = {
  propellercat: "A cheerful young cartoon cat with a light, bright voice. Playful and warm, quick friendly pace, clear American accent.",
  selmatek: "A huge, gentle boulder golem with a very deep, rumbling voice. Slow, calm and reassuring, slightly gravelly.",
  moloch: "An ancient tree spirit with an old, creaky, wise voice. Slow and thoughtful, low and woody, gentle British accent.",
  vamporm: "A tiny cute caterpillar creature with a high, squeaky, excited little voice. Fast and bubbly, childlike but clear.",
  noctalo: "A sleek night bat with a smooth, low, slightly mysterious voice. Calm and velvety with a hint of mischief.",
  possessun: "A friendly purple ghost with a soft, airy, slightly echoing voice. A little spooky but kind, slow drifting pace.",
  agnidon: "A young fire dragon pup with a warm, energetic, slightly raspy voice. Bold and enthusiastic, fast pace.",
  bigfin: "A big friendly whale with a deep, round, booming but gentle voice. Relaxed, slow and jolly.",
  eaglace: "A regal ice griffin with a clear, crisp, noble voice. Confident and composed, measured pace, refined British accent.",
  chillimp: "A mischievous little ice imp with a quick, cheeky, playful voice. Bright, a bit nasal, always grinning.",
  aardorn: "A small, shy woodland critter with a soft, gentle, sweet young voice. Warm and curious, moderate pace.",
  cateye: "A curious one-eyed cat creature with a smooth, clear, slightly mysterious female voice. Observant and calm.",
  nut: "A small boxy robot with a friendly, even, slightly robotic voice. Precise and helpful with a light mechanical texture.",
};

type Manifest = Record<string, { description: string; previews: string[] }>;

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Set ELEVENLABS_API_KEY in .env.local");
  return key;
}

async function call(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, { method: "POST", headers: { "xi-api-key": apiKey(), "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

function readManifest(): Manifest {
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return {};
  }
}

async function preview(ids: string[]) {
  mkdirSync(OUT, { recursive: true });
  const manifest = readManifest();
  for (const id of ids) {
    const a = assistantById(id);
    const description = `${LOOKS[a.id]} Studio-quality recording, suitable for a friendly car insurance helper.`;
    const text = `Hi! I'm ${a.name}. I'll help you with your car, your policy and your claim. Tell me what happened, and we'll figure out the next step together.`;
    const { previews } = (await call("/text-to-voice/design?output_format=mp3_44100_64", { voice_description: description, text })) as {
      previews: { audio_base_64: string; generated_voice_id: string }[];
    };
    manifest[a.id] = { description, previews: previews.map((p) => p.generated_voice_id) };
    previews.forEach((p, i) => writeFileSync(join(OUT, `${a.id}-${i + 1}.mp3`), Buffer.from(p.audio_base_64, "base64")));
    console.log(`${a.name}: ${previews.length} previews`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nListen: open ${OUT}\nKeep one: npm run voices:design -- save <tuxemon> <preview number>`);
}

async function save(id: string, pick: number) {
  const a = assistantById(id);
  const entry = readManifest()[a.id];
  const generated = entry?.previews[pick - 1];
  if (!generated) throw new Error(`No preview ${pick} for ${a.name}. Run: npm run voices:design -- ${a.id}`);
  const { voice_id } = (await call("/text-to-voice", {
    voice_name: `BeCarful ${a.name}`,
    voice_description: entry.description,
    generated_voice_id: generated,
    played_not_selected_voice_ids: entry.previews.filter((p) => p !== generated),
  })) as { voice_id: string };
  console.log(`Saved "BeCarful ${a.name}". In VOICES (src/components/chat/assistants.ts) use:\n  ${a.id}: { name: "BeCarful ${a.name}", id: "${voice_id}", speed: ${a.voice.speed} },`);
}

async function main() {
  const [first, ...rest] = process.argv.slice(2);
  if (first === "save") return save(rest[0] ?? "", Number(rest[1]));
  const ids = first ? [first, ...rest] : ASSISTANTS.map((a) => a.id);
  const unknown = ids.filter((id) => !LOOKS[id]);
  if (unknown.length) throw new Error(`Unknown Tuxemon: ${unknown.join(", ")}. Use: ${ASSISTANTS.map((a) => a.id).join(", ")}`);
  await preview(ids);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
