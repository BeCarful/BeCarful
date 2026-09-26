import type { DamageReport } from "./damage-report";

/**
 * Made-up data for a front-right collision, used until the damage model exists.
 * It covers every level of the 6-level scale so all colors can be checked.
 */
// TODO(codex): Replace with the assessment result from the backend API once it is exposed.
export const SAMPLE_DAMAGE_REPORT: DamageReport = {
  parts: [
    { partId: "front_bumper", score: 0.92 },
    { partId: "fender_front_right", score: 0.78 },
    { partId: "headlight_right", score: 0.66 },
    { partId: "hood", score: 0.45 },
    { partId: "door_front_right", score: 0.28 },
    { partId: "mirror_right", score: 0.08 },
  ],
};
