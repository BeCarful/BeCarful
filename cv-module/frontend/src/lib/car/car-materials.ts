import * as THREE from "three";

import {
  GLASS_COLOR,
  PAINT_COLOR,
  RIM_COLOR,
  TIRE_COLOR,
  TRIM_COLOR,
} from "./car-config";

export type CarMaterials = {
  paint: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  tire: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  headlight: THREE.MeshStandardMaterial;
  taillight: THREE.MeshStandardMaterial;
};

let cachedMaterials: CarMaterials | null = null;

/**
 * Creates the white glossy car paint (clearcoat gives the showroom shine).
 */
export function createPaintMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: PAINT_COLOR,
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
}

/**
 * Returns the shared set of car materials, creating it on first use.
 *
 * Why: every mesh reuses the same material instances, so the GPU compiles
 * each shader once instead of once per mesh.
 */
export function getCarMaterials(): CarMaterials {
  if (cachedMaterials) {
    return cachedMaterials;
  }

  cachedMaterials = {
    paint: createPaintMaterial(),
    glass: new THREE.MeshPhysicalMaterial({
      color: GLASS_COLOR,
      roughness: 0.05,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
      // Why: the flat side-window shapes face +z, so the right side is seen from behind.
      side: THREE.DoubleSide,
    }),
    tire: new THREE.MeshStandardMaterial({ color: TIRE_COLOR, roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({
      color: RIM_COLOR,
      roughness: 0.25,
      metalness: 0.9,
    }),
    trim: new THREE.MeshStandardMaterial({ color: TRIM_COLOR, roughness: 0.7 }),
    headlight: new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#e8f1ff",
      emissiveIntensity: 1.2,
    }),
    // Why: a smoked grey lens instead of red, so an undamaged taillight is never
    // mistaken for the red end of the damage scale. Only damage uses color.
    taillight: new THREE.MeshStandardMaterial({
      color: "#4a4f57",
      roughness: 0.2,
      metalness: 0.3,
    }),
  };

  return cachedMaterials;
}

export const SELECTION_COLOR = "#2563eb";
const damageMaterials = new Map<string, THREE.MeshStandardMaterial>();
const selectedBaseMaterials = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Returns the flat, slightly glossy material used to paint a damaged part in
 * its damage-level color.
 */
export function getDamageMaterial(color: string): THREE.MeshStandardMaterial {
  let material = damageMaterials.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.05,
      emissive: color,
      // Why: a touch of self-light keeps dark levels readable on the shadow side.
      emissiveIntensity: 0.08,
    });
    damageMaterials.set(color, material);
  }
  return material;
}

/**
 * Returns a copy of an undamaged part's normal material with a blue glow,
 * shown while that part is selected.
 */
export function getSelectedMaterial(
  baseMaterial: THREE.MeshStandardMaterial,
): THREE.MeshStandardMaterial {
  let material = selectedBaseMaterials.get(baseMaterial.uuid);
  if (!material) {
    material = baseMaterial.clone();
    material.emissive = new THREE.Color(SELECTION_COLOR);
    material.emissiveIntensity = 0.35;
    selectedBaseMaterials.set(baseMaterial.uuid, material);
  }
  return material;
}
