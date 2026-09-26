import type { DamageReport } from "./damage-report";

/**
 * Made-up data for a front-right collision, used until the damage model exists.
 * It covers every level of the 6-level scale so all colors can be checked.
 */
// TODO(codex): Replace with the assessment result from the backend API once it is exposed.
export const SAMPLE_DAMAGE_REPORT: DamageReport = {
  parts: [
    {
      partId: "front_bumper",
      severity: "severe",
      damageTypes: ["deformation_other"],
    },
    {
      partId: "fender_front_right",
      severity: "moderate",
      damageTypes: ["dent"],
    },
    {
      partId: "headlight_right",
      severity: "severe",
      damageTypes: ["lamp_broken"],
    },
    { partId: "hood", severity: "moderate", damageTypes: ["dent"] },
    { partId: "door_front_right", severity: "minor", damageTypes: ["scratch"] },
    { partId: "mirror_right", severity: "minor", damageTypes: ["scratch"] },
  ],
};
