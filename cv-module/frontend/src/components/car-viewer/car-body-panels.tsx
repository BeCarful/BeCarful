"use client";

import { useMemo } from "react";
import * as THREE from "three";

import {
  BODY_PROFILE,
  BODY_SIDE_Z,
  BODY_BEVEL,
  CABIN_PROFILE,
  CABIN_SIDE_Z,
  placeAlongEdge,
} from "@/lib/car/car-geometry";
import { getCarMaterials } from "@/lib/car/car-materials";
import {
  createFrontFenderShape,
  createFrontWindowShape,
  createRearFenderShape,
  createRearSideGlassShape,
} from "@/lib/car/car-panel-geometry";
import {
  CAR_SIDES,
  type CarSide,
  type PartId,
  sideName,
} from "@/lib/car/car-parts";

import { PartMesh } from "./car-part";

const PANEL_THICKNESS = 0.015;
/** Gap between a side panel and the body, so the two never z-fight. */
const SIDE_PANEL_GAP = 0.003;

type EdgePanelProps = {
  partId: PartId;
  from: THREE.Vector2;
  to: THREE.Vector2;
  width: number;
  inset: number;
  baseMaterial: THREE.MeshStandardMaterial;
  hasSeams?: boolean;
};

/**
 * A part lying along one edge of the side profile: hood, roof, bumpers, glass.
 */
function EdgePanel({
  partId,
  from,
  to,
  width,
  inset,
  baseMaterial,
  hasSeams,
}: EdgePanelProps) {
  const placement = placeAlongEdge(from, to, inset);
  return (
    <PartMesh
      partId={partId}
      baseMaterial={baseMaterial}
      hasSeams={hasSeams}
      position={placement.position}
      rotation-z={placement.rotationZ}
    >
      <boxGeometry args={[placement.length, PANEL_THICKNESS, width]} />
    </PartMesh>
  );
}

/**
 * Flips a side panel for the car's left side (-z) so its front face points outward.
 * Why: flat shapes face +z; rotating 180° about x mirrors them in z but also in y,
 * so the shape is mirrored with scale instead.
 */
function sidePanelTransform(side: CarSide, surfaceZ: number) {
  return {
    position: [0, 0, side * (surfaceZ + SIDE_PANEL_GAP)] as [
      number,
      number,
      number,
    ],
    scale: [1, 1, side] as [number, number, number],
  };
}

/**
 * All body parts except the doors, lights, mirrors and wheels.
 */
export function CarBodyPanels() {
  const materials = getCarMaterials();
  const shapes = useMemo(
    () => ({
      frontFender: new THREE.ShapeGeometry(createFrontFenderShape(), 24),
      rearFender: new THREE.ShapeGeometry(createRearFenderShape(), 24),
      frontWindow: new THREE.ShapeGeometry(createFrontWindowShape()),
      rearSideGlass: new THREE.ShapeGeometry(createRearSideGlassShape()),
    }),
    [],
  );
  const { frontBottom, frontBumperTop, nose, rearBumperTop, rearBottom } =
    BODY_PROFILE;
  const { windshieldBase, windshieldTop, roofRear, tailgateBase } =
    CABIN_PROFILE;
  const cabinGlassZ = CABIN_SIDE_Z + BODY_BEVEL;

  return (
    <group>
      <EdgePanel
        partId="front_bumper"
        from={frontBottom}
        to={frontBumperTop}
        width={1.72}
        inset={0.02}
        baseMaterial={materials.paint}
        hasSeams
      />
      <EdgePanel
        partId="hood"
        from={nose}
        to={windshieldBase}
        width={1.6}
        inset={0.04}
        baseMaterial={materials.paint}
        hasSeams
      />
      <EdgePanel
        partId="windshield"
        from={windshieldBase}
        to={windshieldTop}
        width={1.45}
        inset={0.1}
        baseMaterial={materials.glass}
      />
      <EdgePanel
        partId="roof"
        from={windshieldTop}
        to={roofRear}
        width={1.46}
        inset={0.08}
        baseMaterial={materials.paint}
        hasSeams
      />
      <EdgePanel
        partId="rear_window"
        from={roofRear}
        to={tailgateBase}
        width={1.35}
        inset={0.2}
        baseMaterial={materials.glass}
      />
      <EdgePanel
        partId="trunk"
        from={tailgateBase}
        to={rearBumperTop}
        width={1.5}
        inset={0.04}
        baseMaterial={materials.paint}
        hasSeams
      />
      <EdgePanel
        partId="rear_bumper"
        from={rearBumperTop}
        to={rearBottom}
        width={1.72}
        inset={0.02}
        baseMaterial={materials.paint}
        hasSeams
      />

      {CAR_SIDES.map((side) => {
        const bodySide = sidePanelTransform(side, BODY_SIDE_Z);
        const glassSide = sidePanelTransform(side, cabinGlassZ);
        return (
          <group key={side}>
            <PartMesh
              partId={`fender_front_${sideName(side)}`}
              baseMaterial={materials.paint}
              geometry={shapes.frontFender}
              hasSeams
              {...bodySide}
            />
            <PartMesh
              partId={`fender_rear_${sideName(side)}`}
              baseMaterial={materials.paint}
              geometry={shapes.rearFender}
              hasSeams
              {...bodySide}
            />
            <PartMesh
              partId={`window_front_${sideName(side)}`}
              baseMaterial={materials.glass}
              geometry={shapes.frontWindow}
              {...glassSide}
            />
            {/* Rear side glass is not a reportable part yet, so it is not clickable. */}
            <mesh
              geometry={shapes.rearSideGlass}
              material={materials.glass}
              {...glassSide}
            />
          </group>
        );
      })}
    </group>
  );
}
