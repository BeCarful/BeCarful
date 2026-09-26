"use client";

import { WHEEL_RADIUS, WHEEL_WIDTH } from "@/lib/car/car-config";
import { getCarMaterials } from "@/lib/car/car-materials";

const SPOKE_COUNT = 5;
const RIM_RADIUS = 0.21;

type CarWheelProps = {
  position: [number, number, number];
  /** +1 for the left side (+z), -1 for the right side, so the spokes face outward. */
  side: 1 | -1;
};

/**
 * One wheel: tire, silver rim with five spokes, and a center hub.
 */
export function CarWheel({ position, side }: CarWheelProps) {
  const materials = getCarMaterials();
  const outerFaceZ = side * (WHEEL_WIDTH / 2 + 0.006);

  return (
    <group position={position}>
      {/* Why: cylinders stand along y by default; rotating 90° about x lays them along the axle (z). */}
      <mesh rotation-x={Math.PI / 2} material={materials.tire}>
        <cylinderGeometry
          args={[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 40]}
        />
      </mesh>
      <mesh rotation-x={Math.PI / 2} material={materials.trim}>
        <cylinderGeometry
          args={[RIM_RADIUS, RIM_RADIUS, WHEEL_WIDTH + 0.004, 32]}
        />
      </mesh>
      {Array.from({ length: SPOKE_COUNT }, (_, index) => (
        <mesh
          key={index}
          position-z={outerFaceZ}
          rotation-z={(index * Math.PI * 2) / SPOKE_COUNT}
          material={materials.rim}
        >
          <boxGeometry args={[0.045, RIM_RADIUS * 2 - 0.02, 0.012]} />
        </mesh>
      ))}
      <mesh
        position-z={outerFaceZ}
        rotation-x={Math.PI / 2}
        material={materials.rim}
      >
        <cylinderGeometry
          args={[RIM_RADIUS - 0.02, RIM_RADIUS - 0.02, 0.008, 32]}
        />
      </mesh>
      <mesh
        position-z={outerFaceZ}
        rotation-x={Math.PI / 2}
        material={materials.rim}
      >
        <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
      </mesh>
    </group>
  );
}
