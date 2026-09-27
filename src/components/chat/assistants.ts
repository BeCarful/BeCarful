import { PERIL_MONSTERS, type PerilMonster } from "@/components/insurance/peril-monsters";

export type Assistant = PerilMonster & { id: string };

const PROPELLERCAT: PerilMonster = {
  name: "Propellercat",
  sheet: "/tuxemon/propellercat-sheet.png",
  author: "tamashihoshi",
  authorUrl: "https://wiki.tuxemon.org/Tamashihoshi",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
};

export const ASSISTANTS: Assistant[] = [PROPELLERCAT, ...Object.values(PERIL_MONSTERS)].map((m) => ({ id: m.name.toLowerCase(), ...m }));

export const DEFAULT_ASSISTANT = ASSISTANTS[0];

export const assistantById = (id: string | null | undefined) => ASSISTANTS.find((a) => a.id === id) ?? DEFAULT_ASSISTANT;
