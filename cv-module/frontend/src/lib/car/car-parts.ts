/**
 * Names of the car parts that damage can be reported on.
 *
 * The IDs mirror `PartId` in the backend (cv-module/src/cv_module/domain/enums.py)
 * so a model's output can be shown without any mapping. A test keeps them in sync.
 *
 * Left/right follow the usual automotive convention: the driver's left and right
 * when sitting in the car facing forward (not the viewer's left/right).
 */
export const PART_IDS = [
  "hood",
  "roof",
  "trunk",
  "front_bumper",
  "rear_bumper",
  "windshield",
  "rear_window",
  "headlight_left",
  "headlight_right",
  "taillight_left",
  "taillight_right",
  "fender_front_left",
  "fender_front_right",
  "fender_rear_left",
  "fender_rear_right",
  "door_front_left",
  "door_front_right",
  "door_rear_left",
  "door_rear_right",
  "mirror_left",
  "mirror_right",
  "wheel_front_left",
  "wheel_front_right",
  "wheel_rear_left",
  "wheel_rear_right",
  "grille",
  "side_skirt_left",
  "side_skirt_right",
  "window_front_left",
  "window_front_right",
] as const;

export type PartId = (typeof PART_IDS)[number];

/** Human-readable name shown in the UI for each part. */
export const PART_LABELS: Record<PartId, string> = {
  hood: "Hood",
  roof: "Roof",
  // Why: the backend calls it "trunk"; on an MPV like the XL7 it is a tailgate.
  trunk: "Tailgate",
  front_bumper: "Front bumper",
  rear_bumper: "Rear bumper",
  windshield: "Windshield",
  rear_window: "Rear window",
  headlight_left: "Headlight (left)",
  headlight_right: "Headlight (right)",
  taillight_left: "Taillight (left)",
  taillight_right: "Taillight (right)",
  fender_front_left: "Front fender (left)",
  fender_front_right: "Front fender (right)",
  fender_rear_left: "Rear quarter panel (left)",
  fender_rear_right: "Rear quarter panel (right)",
  door_front_left: "Front door (left)",
  door_front_right: "Front door (right)",
  door_rear_left: "Rear door (left)",
  door_rear_right: "Rear door (right)",
  mirror_left: "Side mirror (left)",
  mirror_right: "Side mirror (right)",
  wheel_front_left: "Front wheel (left)",
  wheel_front_right: "Front wheel (right)",
  wheel_rear_left: "Rear wheel (left)",
  wheel_rear_right: "Rear wheel (right)",
  grille: "Grille",
  side_skirt_left: "Side skirt (left)",
  side_skirt_right: "Side skirt (right)",
  window_front_left: "Front window (left)",
  window_front_right: "Front window (right)",
};

/** -1 is the car's left side (−z), +1 its right side (+z). */
export type CarSide = 1 | -1;

export const CAR_SIDES: readonly CarSide[] = [-1, 1];

/** "left" or "right" for a side sign, used to build side-specific part IDs. */
export function sideName(side: CarSide): "left" | "right" {
  return side === 1 ? "right" : "left";
}

/** Type guard for values coming from outside, e.g. an API response. */
export function isPartId(value: string): value is PartId {
  return (PART_IDS as readonly string[]).includes(value);
}
