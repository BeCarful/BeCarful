"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { DOOR_OPEN_ANGLE } from "@/lib/car/car-config";
import { BODY_SIDE_Z } from "@/lib/car/car-geometry";
import { getCarMaterials } from "@/lib/car/car-materials";
import { DOOR_BOTTOM_Y, DOOR_TOP_Y } from "@/lib/car/car-panel-geometry";
import type { CarSide, PartId } from "@/lib/car/car-parts";

import { CarPart, PartOutline } from "./car-part";
import { usePartMaterial } from "./damage-context";

const DOOR_THICKNESS = 0.04;
const DOOR_SWING_SPEED = 6;

type CarDoorProps = {
  partId: PartId;
  /** -1 for the car's left side (-z), +1 for its right side (+z). */
  side: CarSide;
  /** x position of the door's front edge, where it hinges. */
  hingeX: number;
  /** x position of the door's rear edge. */
  rearX: number;
  isOpen: boolean;
};

/**
 * A side door that swings open around its front edge.
 * A dark panel behind it shows the door opening when it swings out.
 */
export function CarDoor({ partId, side, hingeX, rearX, isOpen }: CarDoorProps) {
  const hingeRef = useRef<THREE.Group>(null);
  const materials = getCarMaterials();
  const panelMaterial = usePartMaterial(partId, materials.paint);
  const doorLength = hingeX - rearX;
  const doorHeight = DOOR_TOP_Y - DOOR_BOTTOM_Y;
  const centerY = (DOOR_BOTTOM_Y + DOOR_TOP_Y) / 2;
  const hingeZ = side * (BODY_SIDE_Z + DOOR_THICKNESS / 2 + 0.003);

  useFrame((_, delta) => {
    const hinge = hingeRef.current;
    if (!hinge) {
      return;
    }
    // Why: a positive y-rotation swings the rear edge toward +z, so the left (-z) door uses the negative angle.
    const targetAngle = isOpen ? side * DOOR_OPEN_ANGLE : 0;
    hinge.rotation.y = THREE.MathUtils.damp(
      hinge.rotation.y,
      targetAngle,
      DOOR_SWING_SPEED,
      delta,
    );
  });

  return (
    <group>
      <mesh
        position={[
          hingeX - doorLength / 2,
          centerY,
          side * (BODY_SIDE_Z + 0.002),
        ]}
        material={materials.trim}
      >
        <boxGeometry args={[doorLength - 0.04, doorHeight - 0.04, 0.002]} />
      </mesh>
      <CarPart
        partId={partId}
        ref={hingeRef}
        position={[hingeX, centerY, hingeZ]}
      >
        <mesh position-x={-doorLength / 2} material={panelMaterial}>
          <boxGeometry args={[doorLength, doorHeight, DOOR_THICKNESS]} />
          <PartOutline partId={partId} hasSeams />
        </mesh>
        {/* Door handle */}
        <mesh
          position={[
            -doorLength + 0.2,
            doorHeight / 2 - 0.12,
            side * (DOOR_THICKNESS / 2 + 0.01),
          ]}
          material={materials.trim}
        >
          <boxGeometry args={[0.16, 0.03, 0.02]} />
        </mesh>
      </CarPart>
    </group>
  );
}
