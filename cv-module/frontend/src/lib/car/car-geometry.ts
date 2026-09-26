import * as THREE from "three";

import { CAR_WIDTH, WHEEL_RADIUS, WHEELBASE } from "./car-config";

/*
 * Coordinate system used by the procedural car:
 *   x = length (front of the car is +x), y = up, z = width (+z is the left side).
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

/** Corner points of the cabin profile, reused to place the glass. */
export const CABIN_PROFILE = {
  windshieldBase: new THREE.Vector2(1.2, 1.0),
  windshieldTop: new THREE.Vector2(0.3, 1.6),
  roofRear: new THREE.Vector2(-2.05, 1.62),
  tailgateBase: new THREE.Vector2(-2.2, 1.0),
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
 * Builds the lower body (bumpers, hood, doors area) with both wheel arches cut out.
 */
export function createLowerBodyGeometry(): THREE.ExtrudeGeometry {
  const bottomY = WHEEL_RADIUS;
  const shape = new THREE.Shape();

  shape.moveTo(-2.23, bottomY);
  shape.lineTo(REAR_AXLE_X - WHEEL_ARCH_RADIUS, bottomY);
  // Why: clockwise from π to 0 walks the arc over the top of the wheel.
  shape.absarc(REAR_AXLE_X, bottomY, WHEEL_ARCH_RADIUS, Math.PI, 0, true);
  shape.lineTo(FRONT_AXLE_X - WHEEL_ARCH_RADIUS, bottomY);
  shape.absarc(FRONT_AXLE_X, bottomY, WHEEL_ARCH_RADIUS, Math.PI, 0, true);
  shape.lineTo(2.22, bottomY);
  shape.lineTo(2.25, 0.62);
  shape.lineTo(2.15, 0.88);
  shape.lineTo(CABIN_PROFILE.windshieldBase.x, CABIN_PROFILE.windshieldBase.y);
  shape.lineTo(CABIN_PROFILE.tailgateBase.x, CABIN_PROFILE.tailgateBase.y);
  shape.lineTo(-2.26, 0.6);
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

/**
 * Builds the flat side-window outline, slightly inset from the cabin profile.
 */
export function createSideWindowGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(1.02, 1.06);
  shape.lineTo(0.33, 1.53);
  shape.lineTo(-1.98, 1.55);
  shape.lineTo(-2.1, 1.06);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export type GlassPanelPlacement = {
  position: [number, number, number];
  rotationZ: number;
  length: number;
};

/**
 * Places a thin glass panel along a sloped edge of the cabin profile,
 * pushed just outside the surface so it doesn't flicker against the paint.
 */
export function placeGlassAlongEdge(
  from: THREE.Vector2,
  to: THREE.Vector2,
  inset: number,
): GlassPanelPlacement {
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
