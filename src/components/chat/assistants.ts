import { PERIL_MONSTERS, type PerilMonster } from "@/components/insurance/peril-monsters";

export type Assistant = PerilMonster & { id: string; voice: Voice };

const PROPELLERCAT: PerilMonster = {
  name: "Propellercat",
  sheet: "/tuxemon/propellercat-sheet.png",
  author: "tamashihoshi",
  authorUrl: "https://wiki.tuxemon.org/Tamashihoshi",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export type Voice = { name: string; id: string; speed: number };

export const VOICES: Record<string, Voice> = {
  propellercat: { name: "Jessica", id: "cgSgspJ2msm6clMCkdW9", speed: 1 },
  shybulb: { name: "Custom", id: "PTGG14FMgQxK1FuRpw66", speed: 1 },
  rockitten: { name: "Custom", id: "hwPr5vIGEUWuYRL4OQ4p", speed: 1.08 },
  budaye: { name: "Custom", id: "jnEPKYWrJqPpagXg4KmX", speed: 1 },
  anoleaf: { name: "Custom", id: "kITPv0Fgoi8dHj4j4k4B", speed: 1.1 },
  hatchling: { name: "Custom", id: "Tj6DpdatHnC4Eakc7R0w", speed: 1.08 },
  tumbleworm: { name: "Custom", id: "or2YQI8XkXgk7iXLoS81", speed: 1.1 },
  selmatek: { name: "Brian", id: "nPczCjzI2devNBz1zQrb", speed: 0.9 },
  moloch: { name: "Bill", id: "pqHfZKP75CvOlQylNhV4", speed: 0.9 },
  vamporm: { name: "Laura", id: "FGY2WhTYpPnrIDTdsKH5", speed: 1.1 },
  noctalo: { name: "Callum", id: "N2lVS1w4EtoT3dr4eOWO", speed: 1 },
  possessun: { name: "George", id: "JBFqnCBsd6RMkjVDRZzb", speed: 0.95 },
  agnidon: { name: "Charlie", id: "IKne3meq5aSn9XLyUdCD", speed: 1.05 },
  bigfin: { name: "Roger", id: "CwhRBWXzGAHq8TQ4Fs17", speed: 0.92 },
  eaglace: { name: "Daniel", id: "onwK4e9ZLuTAKqWW03F9", speed: 1 },
  chillimp: { name: "Liam", id: "TX3LPaxmHKxFdv7VOQHJ", speed: 1.1 },
  hampotamos: { name: "Eric", id: "cjVigY5qzO86Huf0OWal", speed: 0.92 },
  cateye: { name: "Alice", id: "Xb7hH8MSUJpSbSDYk0k2", speed: 1 },
  nut: { name: "River", id: "SAz9YHcvj6GT2YYXdXww", speed: 0.95 },
};

const CC_BY_SA_4 = { license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };

const COMPANIONS: PerilMonster[] = [
  { name: "Shybulb", sheet: "/tuxemon/shybulb-sheet.png", author: "Spalding004 and Sanglorian", authorUrl: "https://wiki.tuxemon.org/Shybulb", ...CC_BY_SA_4 },
  { name: "Rockitten", sheet: "/tuxemon/rockitten-sheet.png", author: "ShadowApex and Leo", authorUrl: "https://wiki.tuxemon.org/Rockitten", ...CC_BY_SA_4 },
  { name: "Budaye", sheet: "/tuxemon/budaye-sheet.png", author: "Leo, Levaine and Sanglorian", authorUrl: "https://wiki.tuxemon.org/Budaye", ...CC_BY_SA_4 },
  { name: "Anoleaf", sheet: "/tuxemon/anoleaf-sheet.png", author: "Spalding004 and Sanglorian", authorUrl: "https://wiki.tuxemon.org/Anoleaf", ...CC_BY_SA_4 },
  { name: "Hatchling", sheet: "/tuxemon/hatchling-sheet.png", author: "tamashihoshi", authorUrl: "https://wiki.tuxemon.org/Hatchling", ...CC_BY_SA_4 },
  {
    name: "Tumbleworm",
    sheet: "/tuxemon/tumbleworm-sheet.png",
    author: "josepharaoh99, Cavalcadeur, Sanglorian and tamashihoshi",
    authorUrl: "https://wiki.tuxemon.org/Tumbleworm",
    ...CC_BY_SA_4,
  },
];

export const ASSISTANTS: Assistant[] = [PROPELLERCAT, ...COMPANIONS, ...Object.values(PERIL_MONSTERS)].map((m) => {
  const id = m.name.toLowerCase();
  return { id, ...m, voice: VOICES[id] ?? VOICES.propellercat };
});

export const DEFAULT_ASSISTANT = ASSISTANTS[0];

export const assistantById = (id: string | null | undefined) => ASSISTANTS.find((a) => a.id === id) ?? DEFAULT_ASSISTANT;
