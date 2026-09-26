"use client";

import { Edges, useCursor } from "@react-three/drei";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { type ReactNode, useState } from "react";
import type * as THREE from "three";

import { SELECTION_COLOR } from "@/lib/car/car-materials";
import type { PartId } from "@/lib/car/car-parts";

import { useDamageContext, usePartMaterial } from "./damage-context";

/** Pointer travel (px) above which a press counts as a drag, not a click. */
const CLICK_DRAG_TOLERANCE = 4;
export const SEAM_COLOR = "#9ea5ae";

type CarPartProps = Omit<ThreeElements["group"], "children"> & {
  partId: PartId;
  children: ReactNode;
};

/**
 * Wraps the meshes of one car part so it can be hovered and clicked to select it.
 */
export function CarPart({ partId, children, ...groupProps }: CarPartProps) {
  const { selectPart } = useDamageContext();
  const [isHovered, setIsHovered] = useState(false);
  useCursor(isHovered);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    // Why: releasing the mouse after orbiting the camera also fires a click.
    if (event.delta > CLICK_DRAG_TOLERANCE) {
      return;
    }
    event.stopPropagation();
    selectPart(partId);
  };

  return (
    <group
      {...groupProps}
      name={partId}
      userData={{ partId }}
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        setIsHovered(true);
      }}
      onPointerOut={() => setIsHovered(false)}
    >
      {children}
    </group>
  );
}

type PartMeshProps = Omit<ThreeElements["mesh"], "material" | "children"> & {
  partId: PartId;
  baseMaterial: THREE.MeshStandardMaterial;
  /** Draws a thin outline so the panel's borders are visible on the white body. */
  hasSeams?: boolean;
  children?: ReactNode;
};

type PartOutlineProps = {
  partId: PartId;
  /** Draws a thin seam line when the part is not selected. */
  hasSeams?: boolean;
};

/**
 * Outline for a part's mesh: a thick blue line while the part is selected,
 * otherwise an optional thin seam so panel borders show on the white body.
 * Must be rendered as a child of the mesh it outlines.
 */
export function PartOutline({ partId, hasSeams = false }: PartOutlineProps) {
  const { selectedPartId } = useDamageContext();
  if (selectedPartId === partId) {
    return <Edges color={SELECTION_COLOR} threshold={20} lineWidth={3} />;
  }
  return hasSeams ? <Edges color={SEAM_COLOR} threshold={20} /> : null;
}

/**
 * A car part made of a single mesh, colored by its damage level.
 */
export function PartMesh({
  partId,
  baseMaterial,
  hasSeams = false,
  children,
  ...meshProps
}: PartMeshProps) {
  const material = usePartMaterial(partId, baseMaterial);

  return (
    <CarPart partId={partId}>
      <mesh {...meshProps} material={material}>
        {children}
        <PartOutline partId={partId} hasSeams={hasSeams} />
      </mesh>
    </CarPart>
  );
}
