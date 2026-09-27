import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VOICES } from "@/components/chat/assistants";

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
  aardorn: "A small, shy woodland critter with a soft, sweet, youthful voice. Warm and curious, moderate pace. Young adult cartoon character.",
  cateye: "A curious one-eyed cat creature with a smooth, clear, slightly mysterious female voice. Observant and calm.",
  nut: "A small boxy robot with a friendly, even, slightly robotic voice. Precise and helpful with a light mechanical texture.",
  shybulb: "A shy little plant bulb sprite with a soft, gentle, youthful voice. Quiet and sweet, a little hesitant, very warm. Young adult cartoon character.",
  rockitten: "A playful round rock kitten with a bright, bubbly, youthful voice. Cheerful and cuddly, quick upbeat pace. Young adult cartoon character.",
  budaye: "A friendly big-eyed aye-aye creature with a warm, encouraging, youthful voice. Gentle, curious and supportive, smooth pace. Young adult cartoon character.",
  anoleaf: "A lively little leaf lizard with a quick, sprightly, youthful voice. Energetic and friendly, light and crisp. Young adult cartoon character.",
  hatchling: "A tiny bird peeking out of its egg with a light, chirpy, youthful voice. Innocent and excited, bouncy pace. Young adult cartoon character.",
  tumbleworm: "A cheerful striped grub with a goofy, upbeat, youthful voice. Smiley and enthusiastic, a little silly. Young adult cartoon character.",
};

const nameOf = (id: string) => id[0].toUpperCase() + id.slice(1);

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
    const name = nameOf(id);
    const description = `${LOOKS[id]} Studio-quality recording, suitable for a friendly car insurance helper.`;
    const text = `Hi! I'm ${name}. I'll help you with your car, your policy and your claim. Tell me what happened, and we'll figure out the next step together.`;
    const { previews } = (await call("/text-to-voice/design?output_format=mp3_44100_64", { voice_description: description, text })) as {
      previews: { audio_base_64: string; generated_voice_id: string }[];
    };
    manifest[id] = { description, previews: previews.map((p) => p.generated_voice_id) };
    previews.forEach((p, i) => writeFileSync(join(OUT, `${id}-${i + 1}.mp3`), Buffer.from(p.audio_base_64, "base64")));
    console.log(`${name}: ${previews.length} previews`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nListen: open ${OUT}\nKeep one: npm run voices:design -- save <tuxemon> <preview number>`);
}

async function save(id: string, pick: number) {
  const name = nameOf(id);
  const entry = readManifest()[id];
  const generated = entry?.previews[pick - 1];
  if (!generated) throw new Error(`No preview ${pick} for ${name}. Run: npm run voices:design -- ${id}`);
  const { voice_id } = (await call("/text-to-voice", {
    voice_name: `BeCarful ${name}`,
    voice_description: entry.description,
    generated_voice_id: generated,
    played_not_selected_voice_ids: entry.previews.filter((p) => p !== generated),
  })) as { voice_id: string };
  console.log(`Saved "BeCarful ${name}". In VOICES (src/components/chat/assistants.ts) use:\n  ${id}: { name: "Custom", id: "${voice_id}", speed: ${VOICES[id]?.speed ?? 1.05} },`);
}

async function main() {
  const [first, ...rest] = process.argv.slice(2);
  if (first === "save") return save(rest[0] ?? "", Number(rest[1]));
  const ids = first ? [first, ...rest] : Object.keys(LOOKS);
  const unknown = ids.filter((id) => !LOOKS[id]);
  if (unknown.length) throw new Error(`Unknown Tuxemon: ${unknown.join(", ")}. Use: ${Object.keys(LOOKS).join(", ")}`);
  await preview(ids);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
