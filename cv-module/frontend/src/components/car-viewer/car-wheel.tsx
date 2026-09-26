"use client";

import { WHEEL_RADIUS, WHEEL_WIDTH } from "@/lib/car/car-config";
import { getCarMaterials } from "@/lib/car/car-materials";
import type { CarSide, PartId } from "@/lib/car/car-parts";

import { CarPart, PartOutline } from "./car-part";
import { usePartMaterial } from "./damage-context";

const SPOKE_COUNT = 5;
const RIM_RADIUS = 0.21;

type CarWheelProps = {
  partId: PartId;
  position: [number, number, number];
  /** -1 for the car's left side (-z), +1 for its right side (+z), so the spokes face outward. */
  side: CarSide;
};

/**
 * One wheel: tire, silver rim with five spokes, and a center hub.
 * When damaged, the whole wheel takes the damage color.
 */
export function CarWheel({ partId, position, side }: CarWheelProps) {
  const materials = getCarMaterials();
  const tireMaterial = usePartMaterial(partId, materials.tire);
  const rimMaterial = usePartMaterial(partId, materials.rim);
  const innerRimMaterial = usePartMaterial(partId, materials.trim);
  const outerFaceZ = side * (WHEEL_WIDTH / 2 + 0.006);

  return (
    <CarPart partId={partId} position={position}>
      {/* Why: cylinders stand along y by default; rotating 90° about x lays them along the axle (z). */}
      <mesh rotation-x={Math.PI / 2} material={tireMaterial}>
        <cylinderGeometry
          args={[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 40]}
        />
        <PartOutline partId={partId} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} material={innerRimMaterial}>
        <cylinderGeometry
          args={[RIM_RADIUS, RIM_RADIUS, WHEEL_WIDTH + 0.004, 32]}
        />
      </mesh>
      {Array.from({ length: SPOKE_COUNT }, (_, index) => (
        <mesh
          key={index}
          position-z={outerFaceZ}
          rotation-z={(index * Math.PI * 2) / SPOKE_COUNT}
          material={rimMaterial}
        >
          <boxGeometry args={[0.045, RIM_RADIUS * 2 - 0.02, 0.012]} />
        </mesh>
      ))}
      <mesh
        position-z={outerFaceZ}
        rotation-x={Math.PI / 2}
        material={rimMaterial}
      >
        <cylinderGeometry
          args={[RIM_RADIUS - 0.02, RIM_RADIUS - 0.02, 0.008, 32]}
        />
      </mesh>
      <mesh
        position-z={outerFaceZ}
        rotation-x={Math.PI / 2}
        material={rimMaterial}
      >
        <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
      </mesh>
    </CarPart>
  );
}
