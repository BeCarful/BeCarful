"use client";

import { useMemo } from "react";

import { WHEEL_RADIUS } from "@/lib/car/car-config";
import {
  BODY_BEVEL,
  CABIN_PROFILE,
  CABIN_SIDE_Z,
  createCabinGeometry,
  createLowerBodyGeometry,
  createSideWindowGeometry,
  FRONT_AXLE_X,
  placeGlassAlongEdge,
  REAR_AXLE_X,
  TRACK_HALF_WIDTH,
} from "@/lib/car/car-geometry";
import { getCarMaterials } from "@/lib/car/car-materials";

import { CarDetails } from "./car-details";
import { CarDoor } from "./car-door";
import { CarWheel } from "./car-wheel";

const SIDES = [1, -1] as const;

type ProceduralCarProps = {
  areDoorsOpen: boolean;
};

/**
 * A white MPV shaped like a Suzuki XL7, built entirely from three.js geometry.
 * It is a placeholder until a real .glb model is set in CAR_MODEL_URL.
 */
export function ProceduralCar({ areDoorsOpen }: ProceduralCarProps) {
  const materials = getCarMaterials();
  const lowerBodyGeometry = useMemo(() => createLowerBodyGeometry(), []);
  const cabinGeometry = useMemo(() => createCabinGeometry(), []);
  const sideWindowGeometry = useMemo(() => createSideWindowGeometry(), []);

  const windshield = placeGlassAlongEdge(
    CABIN_PROFILE.windshieldBase,
    CABIN_PROFILE.windshieldTop,
    0.1,
  );
  const rearGlass = placeGlassAlongEdge(
    CABIN_PROFILE.roofRear,
    CABIN_PROFILE.tailgateBase,
    0.2,
  );

  return (
    <group>
      <mesh geometry={lowerBodyGeometry} material={materials.paint} />
      <mesh geometry={cabinGeometry} material={materials.paint} />

      <mesh
        position={windshield.position}
        rotation-z={windshield.rotationZ}
        material={materials.glass}
      >
        <boxGeometry args={[windshield.length, 0.015, 1.45]} />
      </mesh>
      <mesh
        position={rearGlass.position}
        rotation-z={rearGlass.rotationZ}
        material={materials.glass}
      >
        <boxGeometry args={[rearGlass.length, 0.015, 1.35]} />
      </mesh>

      {SIDES.map((side) => (
        <group key={side}>
          <mesh
            geometry={sideWindowGeometry}
            position-z={side * (CABIN_SIDE_Z + BODY_BEVEL + 0.004)}
            material={materials.glass}
          />
          <CarDoor side={side} isOpen={areDoorsOpen} />
          <CarWheel
            position={[FRONT_AXLE_X, WHEEL_RADIUS, side * TRACK_HALF_WIDTH]}
            side={side}
          />
          <CarWheel
            position={[REAR_AXLE_X, WHEEL_RADIUS, side * TRACK_HALF_WIDTH]}
            side={side}
          />
        </group>
      ))}

      <CarDetails />
    </group>
  );
}
