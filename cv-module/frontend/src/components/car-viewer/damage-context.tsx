"use client";

import { createContext, useContext } from "react";
import type * as THREE from "three";

import type { PartId } from "@/lib/car/car-parts";
import {
  getDamageMaterial,
  getSelectedMaterial,
} from "@/lib/car/car-materials";
import type { ResolvedPartDamage } from "@/lib/damage/damage-report";

export type DamageContextValue = {
  damageByPart: Map<PartId, ResolvedPartDamage>;
  selectedPartId: PartId | null;
  selectPart: (partId: PartId | null) => void;
};

/**
 * Shares the damage report and the selected part with every 3D part.
 * Why: React Three Fiber forwards React context into the <Canvas>, so parts deep
 * in the scene can read it without passing props through every level.
 */
export const DamageContext = createContext<DamageContextValue | null>(null);

/** Reads the damage context; throws if a part is rendered outside the viewer. */
export function useDamageContext(): DamageContextValue {
  const value = useContext(DamageContext);
  if (!value) {
    throw new Error(
      "useDamageContext must be used inside <DamageContext value={…}>",
    );
  }
  return value;
}

/**
 * Picks the material for one mesh of a part: the damage-level color if the part
 * is damaged, otherwise its normal material, with a glow while it is selected.
 * Why: a damaged part keeps its exact level color when selected, so selection is
 * never mistaken for a different level; <PartOutline> marks the selection instead.
 */
export function usePartMaterial(
  partId: PartId,
  baseMaterial: THREE.MeshStandardMaterial,
): THREE.MeshStandardMaterial {
  const { damageByPart, selectedPartId } = useDamageContext();
  const damage = damageByPart.get(partId);
  const isSelected = selectedPartId === partId;

  if (damage) {
    return getDamageMaterial(damage.color);
  }
  return isSelected ? getSelectedMaterial(baseMaterial) : baseMaterial;
}
