export type Axis = "+x" | "-x" | "+z" | "-z";

export type CarModel = {
  id: string;
  year: number;
  make: string;
  model: string;
  url: string;
  forward: Axis;
  left: Axis;
  credit: { title: string; author: string; authorUrl: string; sourceUrl: string; license: string; licenseUrl: string };
};

export const CAR_MODELS = [
  {
    id: "lamborghini-sc18",
    year: 2019,
    make: "Lamborghini",
    model: "SC18 Alston",
    url: "/models/lamborghini-sc18.glb",
    forward: "+z",
    left: "+x",
    credit: {
      title: "2019 Lamborghini SC18 Alston",
      author: "Ddiaz Design",
      authorUrl: "https://sketchfab.com/ddiaz-design",
      sourceUrl: "https://sketchfab.com/3d-models/2019-lamborghini-sc18-alston-f64ddc9ca05a4730ab7b84a0420c1a2c",
      license: "CC BY-NC-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    },
  },
  {
    id: "peugeot-308",
    year: 2021,
    make: "Peugeot",
    model: "308",
    url: "/models/peugeot-308.glb",
    forward: "+z",
    left: "+x",
    credit: {
      title: "Peugeot 308",
      author: "Chuối Sấy Giòn Queen Food",
      authorUrl: "https://sketchfab.com/chuoisayqueenfood",
      sourceUrl: "https://sketchfab.com/3d-models/ca-phe-collagen-queen-food-29b09b3440dd4b1e983258377694d99a",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  {
    id: "waymo-firefly",
    year: 2015,
    make: "Waymo",
    model: "Firefly",
    url: "/models/waymo-firefly.glb",
    forward: "+z",
    left: "+x",
    credit: {
      title: "Google unmanned car Waymo",
      author: "Freecreat creator",
      authorUrl: "https://www.freecreat.com/detail/10408.html",
      sourceUrl: "https://www.freecreat.com/detail/10408.html",
      license: "Freecreat purchase",
      licenseUrl: "https://www.freecreat.com/terms.html",
    },
  },
] as const satisfies readonly CarModel[];

export type CarModelId = (typeof CAR_MODELS)[number]["id"];
export const CAR_MODEL_IDS = CAR_MODELS.map((m) => m.id) as [CarModelId, ...CarModelId[]];

export function carModel(id?: string | null): CarModel {
  return CAR_MODELS.find((m) => m.id === id) ?? CAR_MODELS[0];
}
