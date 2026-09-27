// Tuxemon battle sheets per peril; credits and license proof in public/tuxemon/ATTRIBUTION.md.
import type { Peril } from "@/types";

export type PerilMonster = {
  name: string;
  sheet: string;
  author: string;
  authorUrl: string;
  license: string;
  licenseUrl: string;
};

const CC_BY_SA_4 = { license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };

export const PERIL_MONSTERS: Record<Peril, PerilMonster> = {
  collision: {
    name: "Selmatek",
    sheet: "/tuxemon/selmatek-sheet.png",
    author: "Catch Challenger",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Catch_Challenger",
    ...CC_BY_SA_4,
  },
  liability: {
    name: "Moloch",
    sheet: "/tuxemon/moloch-sheet.png",
    author: "Sanglorian",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Sanglorian",
    ...CC_BY_SA_4,
  },
  injury: {
    name: "Vamporm",
    sheet: "/tuxemon/vamporm-sheet.png",
    author: "Spalding004",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Spalding004",
    ...CC_BY_SA_4,
  },
  uninsured_driver: {
    name: "Noctalo",
    sheet: "/tuxemon/noctalo-sheet.png",
    author: "Catch Challenger",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Catch_Challenger",
    ...CC_BY_SA_4,
  },
  theft: {
    name: "Possessun",
    sheet: "/tuxemon/possessun-sheet.png",
    author: "Spalding004",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Spalding004",
    ...CC_BY_SA_4,
  },
  fire: {
    name: "Agnidon",
    sheet: "/tuxemon/agnidon-sheet.png",
    author: "Leo",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Leo",
    ...CC_BY_SA_4,
  },
  flood: {
    name: "Bigfin",
    sheet: "/tuxemon/bigfin-sheet.png",
    author: "Cavalcadeur and rsg167",
    authorUrl: "https://wiki.tuxemon.org/Cavalcadeur",
    ...CC_BY_SA_4,
  },
  storm: {
    name: "Eaglace",
    sheet: "/tuxemon/eaglace-sheet.png",
    author: "Leo and DevilDman",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Leo",
    ...CC_BY_SA_4,
  },
  vandalism: {
    name: "Chillimp",
    sheet: "/tuxemon/chillimp-sheet.png",
    author: "Chickenshowman",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Chickenshowman",
    ...CC_BY_SA_4,
  },
  animal: {
    name: "Hampotamos",
    sheet: "/tuxemon/hampotamos-sheet.png",
    author: "Catch Challenger",
    authorUrl: "https://wiki.tuxemon.org/index.php?title=Catch_Challenger",
    ...CC_BY_SA_4,
  },
  glass: {
    name: "Cateye",
    sheet: "/tuxemon/cateye-sheet.png",
    author: "Cavalcadeur",
    authorUrl: "https://wiki.tuxemon.org/Cavalcadeur",
    ...CC_BY_SA_4,
  },
  roadside: {
    name: "Nut",
    sheet: "/tuxemon/nut-sheet.png",
    author: "TacoBot",
    authorUrl: "https://wiki.tuxemon.org/TacoBot",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
};
