import { PERIL_MONSTERS, type PerilMonster } from "@/components/insurance/peril-monsters";

export type Assistant = PerilMonster & { id: string; voiceId: string };

const PROPELLERCAT: PerilMonster = {
  name: "Propellercat",
  sheet: "/tuxemon/propellercat-sheet.png",
  author: "tamashihoshi",
  authorUrl: "https://wiki.tuxemon.org/Tamashihoshi",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export const VOICES: Record<string, { voice: string; id: string }> = {
  propellercat: { voice: "Jessica", id: "cgSgspJ2msm6clMCkdW9" },
  selmatek: { voice: "Brian", id: "nPczCjzI2devNBz1zQrb" },
  moloch: { voice: "Callum", id: "N2lVS1w4EtoT3dr4eOWO" },
  vamporm: { voice: "River", id: "SAz9YHcvj6GT2YYXdXww" },
  noctalo: { voice: "Daniel", id: "onwK4e9ZLuTAKqWW03F9" },
  possessun: { voice: "Aria", id: "9BWtsMINqrJLrRacOk9x" },
  agnidon: { voice: "Roger", id: "CwhRBWXzGAHq8TQ4Fs17" },
  bigfin: { voice: "Charlie", id: "IKne3meq5aSn9XLyUdCD" },
  eaglace: { voice: "Alice", id: "Xb7hH8MSUJpSbSDYk0k2" },
  chillimp: { voice: "Will", id: "bIHbv24MWmeRgasZH58o" },
  aardorn: { voice: "Eric", id: "cjVigY5qzO86Huf0OWal" },
  cateye: { voice: "Matilda", id: "XrExE9yKIg1WjnnlVkGX" },
  nut: { voice: "Laura", id: "FGY2WhTYpPnrIDTdsKH5" },
};

export const ASSISTANTS: Assistant[] = [PROPELLERCAT, ...Object.values(PERIL_MONSTERS)].map((m) => {
  const id = m.name.toLowerCase();
  return { id, ...m, voiceId: (VOICES[id] ?? VOICES.propellercat).id };
});

export const DEFAULT_ASSISTANT = ASSISTANTS[0];

export const assistantById = (id: string | null | undefined) => ASSISTANTS.find((a) => a.id === id) ?? DEFAULT_ASSISTANT;
