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

const MODELS = [
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
  {
    id: "bmw-m3-e92",
    year: 2011,
    make: "BMW",
    model: "M3",
    url: "/models/bmw-e92.glb",
    forward: "+z",
    left: "+x",
    credit: {
      title: "BMW M3 E92",
      author: "fvrenbld",
      authorUrl: "https://sketchfab.com/890244234",
      sourceUrl: "https://sketchfab.com/3d-models/bmw-m3-e92-6bfdc66c8ea4498fb229c86ac4578c76",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
] as const satisfies readonly CarModel[];

const STAND_INS = [
  ["peugeot-308", 2022, "Toyota", "Corolla"],
  ["peugeot-308", 2023, "Toyota", "Camry"],
  ["peugeot-308", 2021, "Honda", "Civic"],
  ["peugeot-308", 2022, "Honda", "Accord"],
  ["peugeot-308", 2023, "Hyundai", "Elantra"],
  ["peugeot-308", 2021, "Kia", "Forte"],
  ["peugeot-308", 2022, "Mazda", "Mazda3"],
  ["peugeot-308", 2021, "Nissan", "Sentra"],
  ["peugeot-308", 2022, "Subaru", "Impreza"],
  ["peugeot-308", 2020, "Volkswagen", "Golf"],
  ["peugeot-308", 2023, "Tesla", "Model 3"],
  ["bmw-m3-e92", 2021, "Audi", "A5 Coupe"],
  ["bmw-m3-e92", 2019, "Chevrolet", "Camaro"],
  ["bmw-m3-e92", 2020, "Ford", "Mustang GT"],
  ["bmw-m3-e92", 2020, "Infiniti", "Q60"],
  ["bmw-m3-e92", 2022, "Lexus", "RC 350"],
  ["bmw-m3-e92", 2021, "Mercedes-Benz", "C 300 Coupe"],
  ["lamborghini-sc18", 2021, "Audi", "R8"],
  ["lamborghini-sc18", 2021, "Chevrolet", "Corvette Stingray"],
  ["lamborghini-sc18", 2020, "Ferrari", "F8 Tributo"],
  ["lamborghini-sc18", 2022, "McLaren", "720S"],
  ["lamborghini-sc18", 2022, "Porsche", "911 Carrera"],
] as const;

export const CAR_MODELS: readonly CarModel[] = [
  ...MODELS,
  ...STAND_INS.map(([base, year, make, model]) => ({
    ...MODELS.find((m) => m.id === base)!,
    id: `${make} ${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    year,
    make,
    model,
  })),
];
export const CAR_MODEL_IDS = CAR_MODELS.map((m) => m.id) as [string, ...string[]];

export function carModel(id?: string | null): CarModel {
  return CAR_MODELS.find((m) => m.id === id) ?? CAR_MODELS[0];
}
