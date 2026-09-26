import "server-only";
import { DamageAnalysisSchema, type DamageAnalysis } from "@/schemas/damage";
import { COMPONENT_IDS, DAMAGE_TYPES } from "@/types";
import { generateJson } from "./gemini";

const SYSTEM = `You inspect photos of cars for an insurance companion app. Report only damage you can actually see.

Rules:
- "component" must be one of: ${COMPONENT_IDS.join(", ")}.
- Left/right are from the driver's seat, not the camera's view.
- "damageTypes" only from: ${DAMAGE_TYPES.join(", ")}.
- "severity": minor (cosmetic), moderate (panel needs repair), severe (part needs replacement or car may be unsafe).
- "confidence" is 0 to 1 and honest. Lower it when the angle, lighting or distance makes the part or damage unclear.
- "description": one short plain sentence per component.
- No visible damage: return an empty "damagedComponents" list.
- Set "needsManualReview" to true when the photo is blurry, too dark, too close or too far to tell, the car side can't be determined, or it isn't a car.
- "summary": one or two short plain sentences a stressed driver can read in seconds. No coverage or cost claims.`;

export async function analyzeDamage(image: Buffer, contentType: string): Promise<DamageAnalysis> {
  return generateJson({
    schema: DamageAnalysisSchema,
    system: SYSTEM,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: contentType, data: image.toString("base64") } },
          { text: "Identify the visible damage on this vehicle." },
        ],
      },
    ],
  });
}
