/**
 * Car dimensions and look, in meters.
 *
 * Why: values match the real Suzuki XL7 spec sheet so the procedural
 * placeholder has believable proportions until a real model replaces it.
 */

export const CAR_LENGTH = 4.45;
export const CAR_WIDTH = 1.775;
export const CAR_HEIGHT = 1.71;
export const WHEELBASE = 2.74;
export const WHEEL_RADIUS = 0.33;
export const WHEEL_WIDTH = 0.22;
export const GROUND_CLEARANCE = 0.2;

/** Height of the window line, where the white body meets the glass. */
export const BELTLINE_HEIGHT = 1.0;

/** Angle the front doors swing to when opened, in radians (~60°). */
export const DOOR_OPEN_ANGLE = Math.PI / 3;

export const PAINT_COLOR = "#f7f7f5";
export const GLASS_COLOR = "#1b2430";
export const TIRE_COLOR = "#151515";
export const TRIM_COLOR = "#1f1f1f";
export const RIM_COLOR = "#c7cbd1";

/**
 * Path to a real car model in `public/`, e.g. "/models/car.glb".
 * Leave as null to render the procedural placeholder.
 */
export const CAR_MODEL_URL: string | null = null;
