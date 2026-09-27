import type { ComponentId } from "@/types";

export type PartKind = "body" | "glass" | "light" | "taillight" | "wheel";

// ponytail: the model is split by material, so parts are position zones. A model with meshes named by component ID should replace this.
export const ZONE = {
  bumperF: 0.86,
  topL: 0.6,
  topH: 0.45,
  hoodF: 0.3,
  trunkF: -0.35,
  fenderF: 0.35,
  doorSplitF: -0.05,
  quarterF: -0.35,
  glassSideL: 0.5,
  glassLightF: 0.75,
  windowSplitF: -0.1,
};

export function partKind(nodeNames: string[], materialName: string): PartKind {
  const names = [...nodeNames, materialName].join(" ");
  if (/wheel(?![\s_]*arch)|tire|tyre|(?<![a-z])rim|calliper|caliper/i.test(names)) return "wheel";
  if (/red_glass|(?<!de)tail/i.test(names)) return "taillight";
  if (/glass|window/i.test(names)) return "glass";
  if (/(?<!high)light|lamp/i.test(names)) return "light";
  return "body";
}

export function namedPart(nodeNames: string[]): ComponentId | null {
  const names = nodeNames.join(" ").replace(/_/g, " ");
  if (/windshield/i.test(names)) return "windshield";
  const side = /\bleft\b/i.test(names) ? "left" : /\bright\b/i.test(names) ? "right" : null;
  if (!side) return null;
  if (/headlight/i.test(names)) return `${side}_headlight`;
  if (/taillight/i.test(names)) return `${side}_taillight`;
  if (/\bdoor\b|\bmirror\b/i.test(names)) return `${/\brear\b/i.test(names) ? "rear" : "front"}_${side}_door`;
  return null;
}

export function isInterior(nodeNames: string[], materialName: string) {
  return /interior|upholstery|cockpit|cabin|dashboard|seat|(^|[^a-z])int([^a-z]|$)/i.test([...nodeNames, materialName].join(" "));
}

/** f: +1 front … -1 rear, l: +1 car's left … -1 right, h: 0 ground … 1 roof. */
export function classifyPoint({ f, l, h }: { f: number; l: number; h: number }, kind: PartKind): ComponentId {
  const side = l >= 0 ? "left" : "right";
  const end = f >= 0 ? "front" : "rear";
  if (kind === "wheel") return `${end}_${side}_wheel`;
  if (kind === "taillight") return `${side}_taillight`;
  if (kind === "light") return f >= 0 ? `${side}_headlight` : `${side}_taillight`;
  if (kind === "glass") {
    if (f > ZONE.glassLightF) return `${side}_headlight`;
    if (f < -ZONE.glassLightF) return `${side}_taillight`;
    if (Math.abs(l) < ZONE.glassSideL) return f > ZONE.windowSplitF ? "windshield" : "rear_window";
    return f > ZONE.doorSplitF ? `front_${side}_door` : `rear_${side}_door`;
  }
  if (f > ZONE.bumperF) return "front_bumper";
  if (f < -ZONE.bumperF) return "rear_bumper";
  if (Math.abs(l) < ZONE.topL && h > ZONE.topH) return f > ZONE.hoodF ? "hood" : f < ZONE.trunkF ? "trunk" : "roof";
  if (f > ZONE.fenderF) return `front_${side}_fender`;
  if (f > ZONE.doorSplitF) return `front_${side}_door`;
  if (f > ZONE.quarterF) return `rear_${side}_door`;
  return `rear_${side}_quarter`;
}
