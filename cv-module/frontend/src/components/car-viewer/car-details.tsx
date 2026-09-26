"use client";

import { WHEEL_RADIUS } from "@/lib/car/car-config";
import {
  BODY_BEVEL,
  BODY_SIDE_Z,
  CABIN_SIDE_Z,
  FRONT_AXLE_X,
  REAR_AXLE_X,
  WHEEL_ARCH_RADIUS,
} from "@/lib/car/car-geometry";
import { getCarMaterials } from "@/lib/car/car-materials";

const SIDES = [1, -1] as const;
const PILLAR_POSITIONS_X = [-0.2, -1.3];

/**
 * Small parts that make the shape read as an XL7: lights, grille, mirrors,
 * roof rails, blacked-out pillars and black wheel-arch cladding.
 */
export function CarDetails() {
  const materials = getCarMaterials();

  return (
    <group>
      {/* Front grille and lower intake */}
      <mesh position={[2.295, 0.64, 0]} material={materials.trim}>
        <boxGeometry args={[0.03, 0.2, 0.9]} />
      </mesh>
      <mesh position={[2.28, 0.43, 0]} material={materials.trim}>
        <boxGeometry args={[0.03, 0.1, 1.2]} />
      </mesh>

      {SIDES.map((side) => (
        <group key={side}>
          {/* Headlight, sitting on the sloped nose */}
          <mesh
            position={[2.22, 0.8, side * 0.6]}
            rotation-z={0.38}
            material={materials.headlight}
          >
            <boxGeometry args={[0.03, 0.12, 0.38]} />
          </mesh>

          {/* Vertical taillight */}
          <mesh
            position={[-2.28, 0.82, side * 0.72]}
            material={materials.taillight}
          >
            <boxGeometry args={[0.03, 0.3, 0.16]} />
          </mesh>

          {/* Wing mirror */}
          <mesh
            position={[1.02, 1.1, side * (BODY_SIDE_Z + 0.08)]}
            material={materials.paint}
          >
            <boxGeometry args={[0.14, 0.11, 0.16]} />
          </mesh>

          {/* Roof rail */}
          <mesh position={[-0.85, 1.7, side * 0.62]} material={materials.trim}>
            <boxGeometry args={[2.2, 0.035, 0.045]} />
          </mesh>

          {/* Blacked-out B and C pillars over the side glass */}
          {PILLAR_POSITIONS_X.map((pillarX) => (
            <mesh
              key={pillarX}
              position={[
                pillarX,
                1.3,
                side * (CABIN_SIDE_Z + BODY_BEVEL + 0.008),
              ]}
              material={materials.trim}
            >
              <boxGeometry args={[0.09, 0.5, 0.01]} />
            </mesh>
          ))}

          {/* Rocker cladding between the arches */}
          <mesh
            position={[
              (FRONT_AXLE_X + REAR_AXLE_X) / 2,
              WHEEL_RADIUS + 0.05,
              side * (BODY_SIDE_Z + 0.01),
            ]}
            material={materials.trim}
          >
            <boxGeometry
              args={[
                FRONT_AXLE_X - REAR_AXLE_X - WHEEL_ARCH_RADIUS * 2,
                0.1,
                0.02,
              ]}
            />
          </mesh>

          {/* Wheel-arch cladding: half a torus over each wheel */}
          {[FRONT_AXLE_X, REAR_AXLE_X].map((axleX) => (
            <mesh
              key={axleX}
              position={[axleX, WHEEL_RADIUS, side * (BODY_SIDE_Z + 0.01)]}
              material={materials.trim}
            >
              <torusGeometry
                args={[WHEEL_ARCH_RADIUS + 0.02, 0.04, 8, 32, Math.PI]}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
