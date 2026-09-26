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
    taillight: new THREE.MeshStandardMaterial({
      color: "#8a0c0c",
      emissive: "#d01010",
      emissiveIntensity: 0.8,
    }),
  };

  return cachedMaterials;
}
