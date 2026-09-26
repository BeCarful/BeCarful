"use client";

import {
  BODY_BEVEL,
  BODY_SIDE_Z,
  CABIN_SIDE_Z,
  FRONT_AXLE_X,
  REAR_AXLE_X,
  WHEEL_ARCH_RADIUS,
} from "@/lib/car/car-geometry";
import { getCarMaterials } from "@/lib/car/car-materials";
import { SIDE_SKIRT } from "@/lib/car/car-panel-geometry";
import { CAR_SIDES, sideName } from "@/lib/car/car-parts";
import { WHEEL_RADIUS } from "@/lib/car/car-config";

import { PartMesh } from "./car-part";

const PILLAR_POSITIONS_X = [-0.2, -1.3];

/**
 * Smaller parts: grille, lights, mirrors and side skirts (all reportable), plus
 * decoration that is not a reportable part: roof rails, pillars, arch cladding.
 */
export function CarDetails() {
  const materials = getCarMaterials();
  const skirtLength = SIDE_SKIRT.endX - SIDE_SKIRT.startX;

  return (
    <group>
      <PartMesh
        partId="grille"
        baseMaterial={materials.trim}
        position={[2.31, 0.66, 0]}
      >
        <boxGeometry args={[0.03, 0.18, 0.9]} />
      </PartMesh>
      {/* Lower air intake, part of the bumper's look but not its own part */}
      <mesh position={[2.31, 0.43, 0]} material={materials.trim}>
        <boxGeometry args={[0.02, 0.09, 1.2]} />
      </mesh>

      {CAR_SIDES.map((side) => {
        const name = sideName(side);
        return (
          <group key={side}>
            {/* Headlight, sitting on the sloped nose */}
            <PartMesh
              partId={`headlight_${name}`}
              baseMaterial={materials.headlight}
              position={[2.22, 0.8, side * 0.6]}
              rotation-z={0.38}
            >
              <boxGeometry args={[0.03, 0.12, 0.38]} />
            </PartMesh>

            {/* Vertical taillight at the tailgate's outer edge */}
            <PartMesh
              partId={`taillight_${name}`}
              baseMaterial={materials.taillight}
              position={[-2.305, 0.82, side * 0.76]}
            >
              <boxGeometry args={[0.03, 0.3, 0.16]} />
            </PartMesh>

            <PartMesh
              partId={`mirror_${name}`}
              baseMaterial={materials.paint}
              position={[1.02, 1.1, side * (BODY_SIDE_Z + 0.08)]}
            >
              <boxGeometry args={[0.14, 0.11, 0.16]} />
            </PartMesh>

            <PartMesh
              partId={`side_skirt_${name}`}
              baseMaterial={materials.trim}
              position={[
                SIDE_SKIRT.startX + skirtLength / 2,
                SIDE_SKIRT.bottomY + SIDE_SKIRT.height / 2,
                side * (BODY_SIDE_Z + 0.01),
              ]}
            >
              <boxGeometry args={[skirtLength, SIDE_SKIRT.height, 0.02]} />
            </PartMesh>

            {/* Roof rail */}
            <mesh
              position={[-0.85, 1.7, side * 0.62]}
              material={materials.trim}
            >
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
        );
      })}
    </group>
  );
}
