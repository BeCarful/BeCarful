"use client";

import { useMemo } from "react";

import { WHEEL_RADIUS } from "@/lib/car/car-config";
import {
  createCabinGeometry,
  createLowerBodyGeometry,
  FRONT_AXLE_X,
  REAR_AXLE_X,
  TRACK_HALF_WIDTH,
} from "@/lib/car/car-geometry";
import { getCarMaterials } from "@/lib/car/car-materials";
import { FRONT_DOOR, REAR_DOOR } from "@/lib/car/car-panel-geometry";
import { CAR_SIDES, sideName } from "@/lib/car/car-parts";

import { CarBodyPanels } from "./car-body-panels";
import { CarDetails } from "./car-details";
import { CarDoor } from "./car-door";
import { CarWheel } from "./car-wheel";

type ProceduralCarProps = {
  areDoorsOpen: boolean;
};

/**
 * A white MPV shaped like a Suzuki XL7, built entirely from three.js geometry.
 * Every reportable part (see car-parts.ts) is its own mesh that can be colored by
 * damage level and clicked. It is a placeholder until a real .glb model is set.
 */
export function ProceduralCar({ areDoorsOpen }: ProceduralCarProps) {
  const materials = getCarMaterials();
  const lowerBodyGeometry = useMemo(() => createLowerBodyGeometry(), []);
  const cabinGeometry = useMemo(() => createCabinGeometry(), []);

  return (
    <group>
      {/* The white shell underneath all the parts */}
      <mesh geometry={lowerBodyGeometry} material={materials.paint} />
      <mesh geometry={cabinGeometry} material={materials.paint} />

      <CarBodyPanels />

      {CAR_SIDES.map((side) => {
        const name = sideName(side);
        return (
          <group key={side}>
            <CarDoor
              partId={`door_front_${name}`}
              side={side}
              hingeX={FRONT_DOOR.hingeX}
              rearX={FRONT_DOOR.rearX}
              isOpen={areDoorsOpen}
            />
            <CarDoor
              partId={`door_rear_${name}`}
              side={side}
              hingeX={REAR_DOOR.hingeX}
              rearX={REAR_DOOR.rearX}
              isOpen={areDoorsOpen}
            />
            <CarWheel
              partId={`wheel_front_${name}`}
              position={[FRONT_AXLE_X, WHEEL_RADIUS, side * TRACK_HALF_WIDTH]}
              side={side}
            />
            <CarWheel
              partId={`wheel_rear_${name}`}
              position={[REAR_AXLE_X, WHEEL_RADIUS, side * TRACK_HALF_WIDTH]}
              side={side}
            />
          </group>
        );
      })}

      <CarDetails />
    </group>
  );
}
