"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { DOOR_OPEN_ANGLE } from "@/lib/car/car-config";
import { BODY_SIDE_Z } from "@/lib/car/car-geometry";
import { getCarMaterials } from "@/lib/car/car-materials";

const DOOR_HINGE_X = 0.85;
const DOOR_LENGTH = 1.05;
const DOOR_BOTTOM_Y = 0.45;
const DOOR_TOP_Y = 0.98;
const DOOR_THICKNESS = 0.04;
const DOOR_SWING_SPEED = 6;

type CarDoorProps = {
  /** +1 for the left side (+z), -1 for the right side. */
  side: 1 | -1;
  isOpen: boolean;
};

/**
 * A front door that swings open around its front edge.
 * A dark panel behind it shows the door opening when it swings out.
 */
export function CarDoor({ side, isOpen }: CarDoorProps) {
  const hingeRef = useRef<THREE.Group>(null);
  const materials = getCarMaterials();
  const doorHeight = DOOR_TOP_Y - DOOR_BOTTOM_Y;
  const centerY = (DOOR_BOTTOM_Y + DOOR_TOP_Y) / 2;
  const hingeZ = side * (BODY_SIDE_Z + DOOR_THICKNESS / 2 + 0.003);

  useFrame((_, delta) => {
    const hinge = hingeRef.current;
    if (!hinge) {
      return;
    }
    // Why: a positive y-rotation swings the rear edge toward +z, so the right door uses the negative angle.
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
          DOOR_HINGE_X - DOOR_LENGTH / 2,
          centerY,
          side * (BODY_SIDE_Z + 0.002),
        ]}
        material={materials.trim}
      >
        <boxGeometry args={[DOOR_LENGTH - 0.04, doorHeight - 0.04, 0.002]} />
      </mesh>
      <group ref={hingeRef} position={[DOOR_HINGE_X, centerY, hingeZ]}>
        <mesh position-x={-DOOR_LENGTH / 2} material={materials.paint}>
          <boxGeometry args={[DOOR_LENGTH, doorHeight, DOOR_THICKNESS]} />
        </mesh>
        {/* Door handle */}
        <mesh
          position={[
            -DOOR_LENGTH + 0.2,
            doorHeight / 2 - 0.12,
            side * (DOOR_THICKNESS / 2 + 0.01),
          ]}
          material={materials.trim}
        >
          <boxGeometry args={[0.16, 0.03, 0.02]} />
        </mesh>
      </group>
    </group>
  );
}
