import * as THREE from "three";

import {
  addWheelArch,
  BELTLINE_Y,
  BODY_BOTTOM_Y,
  BODY_PROFILE,
  CABIN_PROFILE,
  FRONT_AXLE_X,
  REAR_AXLE_X,
  WHEEL_ARCH_RADIUS,
} from "./car-geometry";

/*
 * Outlines of the panels on the car's flat sides, in the x/y side-profile plane.
 * Each one is drawn as a flat shape just outside the body and can be colored on
 * its own. Doors are separate boxes (see car-door.tsx) so they can swing open.
 */

/** Door edges along x. The front edge is where each door hinges. */
export const FRONT_DOOR = { hingeX: 0.85, rearX: -0.2 };
export const REAR_DOOR = { hingeX: -0.2, rearX: -0.98 };

/** Door panels stop short of the beltline and the side skirt. */
export const DOOR_BOTTOM_Y = 0.45;
export const DOOR_TOP_Y = 0.98;

/** Side skirt: the black strip along the bottom, between the wheel arches. */
export const SIDE_SKIRT = {
  startX: REAR_AXLE_X + WHEEL_ARCH_RADIUS,
  endX: FRONT_AXLE_X - WHEEL_ARCH_RADIUS,
  bottomY: BODY_BOTTOM_Y,
  height: 0.1,
};

/** Where the fenders end and the bumper corners begin. */
const FRONT_FENDER_END_X = 2.1;
const REAR_FENDER_END_X = -2.15;

/** Height of the hood line at a given x, between the nose and the windshield. */
function hoodLineY(x: number): number {
  const { nose } = BODY_PROFILE;
  const { windshieldBase } = CABIN_PROFILE;
  const t = (x - windshieldBase.x) / (nose.x - windshieldBase.x);
  return windshieldBase.y + (nose.y - windshieldBase.y) * t;
}

/**
 * Front fender: from the front door to the bumper corner, above the front wheel.
 */
export function createFrontFenderShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(FRONT_DOOR.hingeX, BODY_BOTTOM_Y);
  addWheelArch(shape, FRONT_AXLE_X);
  shape.lineTo(FRONT_FENDER_END_X, BODY_BOTTOM_Y);
  shape.lineTo(FRONT_FENDER_END_X, hoodLineY(FRONT_FENDER_END_X));
  shape.lineTo(CABIN_PROFILE.windshieldBase.x, BELTLINE_Y);
  shape.lineTo(FRONT_DOOR.hingeX, BELTLINE_Y);
  shape.closePath();
  return shape;
}

/**
 * Rear quarter panel: from the rear door to the bumper corner, above the rear wheel.
 */
export function createRearFenderShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(REAR_FENDER_END_X, BODY_BOTTOM_Y);
  // The arch ends exactly at the rear door edge, so no extra point is needed there.
  addWheelArch(shape, REAR_AXLE_X);
  shape.lineTo(REAR_DOOR.rearX, BELTLINE_Y);
  shape.lineTo(REAR_FENDER_END_X, BELTLINE_Y);
  shape.closePath();
  return shape;
}

/** Bottom edge of the side glass, just above the beltline. */
const WINDOW_BOTTOM_Y = 1.06;
const B_PILLAR_X = FRONT_DOOR.rearX;

/**
 * Front side window, in the front door, between the A-pillar and B-pillar.
 */
export function createFrontWindowShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(B_PILLAR_X, WINDOW_BOTTOM_Y);
  shape.lineTo(1.02, WINDOW_BOTTOM_Y);
  shape.lineTo(0.33, 1.53);
  shape.lineTo(B_PILLAR_X, 1.535);
  shape.closePath();
  return shape;
}

/**
 * Rear side glass behind the B-pillar (rear door window and quarter glass).
 * Not a reportable part in the backend yet, so it is drawn as plain glass.
 */
export function createRearSideGlassShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-2.1, WINDOW_BOTTOM_Y);
  shape.lineTo(B_PILLAR_X, WINDOW_BOTTOM_Y);
  shape.lineTo(B_PILLAR_X, 1.535);
  shape.lineTo(-1.98, 1.55);
  shape.closePath();
  return shape;
}
