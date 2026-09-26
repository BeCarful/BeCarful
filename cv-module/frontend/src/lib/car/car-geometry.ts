import * as THREE from "three";

import { CAR_WIDTH, WHEEL_RADIUS, WHEELBASE } from "./car-config";

/*
 * Coordinate system used by the procedural car:
 *   x = length (front of the car is +x), y = up, z = width.
 *   +z is the car's RIGHT side and -z its LEFT side (driver's view, facing forward).
 * Side profiles are drawn in the x/y plane and extruded along z.
 */

export const BODY_BEVEL = 0.04;
export const CABIN_WIDTH = 1.62;
export const WHEEL_ARCH_RADIUS = 0.44;

/** Wheel centers along x. Why: the XL7's front overhang is ~0.1 m longer than the rear. */
export const FRONT_AXLE_X = WHEELBASE / 2 - 0.05;
export const REAR_AXLE_X = -WHEELBASE / 2 - 0.05;

/** Wheel centers across z, tucked slightly inside the body. */
export const TRACK_HALF_WIDTH = CAR_WIDTH / 2 - 0.1;

/** Outer surface of the white body sides. */
export const BODY_SIDE_Z = CAR_WIDTH / 2;

/** Outer surface of the cabin sides, where the side glass sits. */
export const CABIN_SIDE_Z = CABIN_WIDTH / 2;

/** Bottom edge of the body, level with the wheel centers. */
export const BODY_BOTTOM_Y = WHEEL_RADIUS;

/** Height of the window line along the doors. */
export const BELTLINE_Y = 1.0;

/** Corner points of the lower body's side profile, front to back. */
export const BODY_PROFILE = {
  frontBottom: new THREE.Vector2(2.22, BODY_BOTTOM_Y),
  frontBumperTop: new THREE.Vector2(2.25, 0.62),
  nose: new THREE.Vector2(2.15, 0.88),
  rearBumperTop: new THREE.Vector2(-2.26, 0.6),
  rearBottom: new THREE.Vector2(-2.23, BODY_BOTTOM_Y),
};

/** Corner points of the cabin profile, reused to place the glass and roof. */
export const CABIN_PROFILE = {
  windshieldBase: new THREE.Vector2(1.2, BELTLINE_Y),
  windshieldTop: new THREE.Vector2(0.3, 1.6),
  roofRear: new THREE.Vector2(-2.05, 1.62),
  tailgateBase: new THREE.Vector2(-2.2, BELTLINE_Y),
};

/**
 * Extrudes a side profile across the car, centered on z = 0.
 * The bevel rounds every edge so the boxy shape reads as a car body.
 */
function extrudeProfile(
  shape: THREE.Shape,
  totalWidth: number,
): THREE.ExtrudeGeometry {
  const depth = totalWidth - BODY_BEVEL * 2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: BODY_BEVEL,
    bevelSize: BODY_BEVEL,
    bevelSegments: 4,
    curveSegments: 24,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Adds a wheel-arch cutout while drawing a shape's bottom edge from rear to front.
 * Why: clockwise from π to 0 walks the arc over the top of the wheel, rear to front.
 */
export function addWheelArch(shape: THREE.Shape, axleX: number): void {
  shape.lineTo(axleX - WHEEL_ARCH_RADIUS, BODY_BOTTOM_Y);
  shape.absarc(axleX, BODY_BOTTOM_Y, WHEEL_ARCH_RADIUS, Math.PI, 0, true);
}

/**
 * Builds the white lower body shell with both wheel arches cut out.
 * The damage-reportable panels are drawn on top of it (see car-panel-geometry.ts).
 */
export function createLowerBodyGeometry(): THREE.ExtrudeGeometry {
  const { frontBottom, frontBumperTop, nose, rearBumperTop, rearBottom } =
    BODY_PROFILE;
  const shape = new THREE.Shape();

  shape.moveTo(rearBottom.x, rearBottom.y);
  addWheelArch(shape, REAR_AXLE_X);
  addWheelArch(shape, FRONT_AXLE_X);
  shape.lineTo(frontBottom.x, frontBottom.y);
  shape.lineTo(frontBumperTop.x, frontBumperTop.y);
  shape.lineTo(nose.x, nose.y);
  shape.lineTo(CABIN_PROFILE.windshieldBase.x, CABIN_PROFILE.windshieldBase.y);
  shape.lineTo(CABIN_PROFILE.tailgateBase.x, CABIN_PROFILE.tailgateBase.y);
  shape.lineTo(rearBumperTop.x, rearBumperTop.y);
  shape.closePath();

  return extrudeProfile(shape, CAR_WIDTH);
}

/**
 * Builds the upper cabin with its sloped windshield and near-vertical MPV tailgate.
 */
export function createCabinGeometry(): THREE.ExtrudeGeometry {
  const { windshieldBase, windshieldTop, roofRear, tailgateBase } =
    CABIN_PROFILE;
  const shape = new THREE.Shape();

  shape.moveTo(windshieldBase.x, windshieldBase.y);
  shape.lineTo(windshieldTop.x, windshieldTop.y);
  shape.lineTo(roofRear.x, roofRear.y);
  shape.lineTo(tailgateBase.x, tailgateBase.y);
  shape.closePath();

  return extrudeProfile(shape, CABIN_WIDTH);
}

export type EdgePanelPlacement = {
  position: [number, number, number];
  rotationZ: number;
  length: number;
};

/**
 * Places a thin panel (glass, hood, roof, bumper…) along one edge of a side
 * profile, pushed just outside the rounded surface so it doesn't flicker.
 * The edge must run so that the outside of the car is on its right-hand side.
 */
export function placeAlongEdge(
  from: THREE.Vector2,
  to: THREE.Vector2,
  inset: number,
): EdgePanelPlacement {
  const edge = new THREE.Vector2().subVectors(to, from);
  const middle = new THREE.Vector2().addVectors(from, to).multiplyScalar(0.5);
  // Why: rotating the edge direction by -90° gives the normal that points out of the car.
  const outwardNormal = new THREE.Vector2(edge.y, -edge.x).normalize();
  const offset = BODY_BEVEL + 0.01;

  return {
    position: [
      middle.x + outwardNormal.x * offset,
      middle.y + outwardNormal.y * offset,
      0,
    ],
    rotationZ: Math.atan2(edge.y, edge.x),
    length: edge.length() - inset,
  };
}
