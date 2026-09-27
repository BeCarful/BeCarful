import "server-only";
import { DamageAnalysisSchema, type DamageAnalysis } from "@/schemas/damage";
import { COMPONENT_IDS, DAMAGE_TYPES, VEHICLE_VIEWS } from "@/types";
import { generateJson } from "./gemini";
import { prepareImage, UnreadablePhotoError, type PreparedPhoto } from "./image-prep";

const SYSTEM = `You inspect photos of cars for an insurance companion app. Report only damage you can actually see.

Rules:
- "view" first: which side of the car the photo shows, one of: ${VEHICLE_VIEWS.join(", ")}. Use "unknown" for close-ups where you can't tell.
- "component" must be one of: ${COMPONENT_IDS.join(", ")}.
- Left/right are from the driver's seat, not the camera's view. Side view: the car's front points to the image's left → you see its left side; to the image's right → its right side. Front view: the car's left is on the image's right. Rear view: the car's left is on the image's left.
- "damageTypes" only from: ${DAMAGE_TYPES.join(", ")}.
- "severity": minor (cosmetic), moderate (panel needs repair), severe (part needs replacement or car may be unsafe).
- "confidence" is 0 to 1 and honest. Lower it when the angle, lighting or distance makes the part or damage unclear.
- "description": one short plain sentence per component.
- "box_2d": a tight box around that component's visible damage as [ymin, xmin, ymax, xmax], normalized to 0-1000.
- No visible damage: return an empty "damagedComponents" list. Don't guess hidden damage.
- Set "needsManualReview" to true when the photo is blurry, too dark, too close or too far to tell, the car side can't be determined, or it isn't a car.
- "summary": one or two short plain sentences a stressed driver can read in seconds. No coverage or cost claims.
- Never estimate repair cost, repair method, drivability, fault, fraud or total loss.
- Never read out license plates, faces, people, addresses or other personal details.`;

const UNREADABLE: DamageAnalysis = {
  view: "unknown",
  damagedComponents: [],
  summary: "",
  needsManualReview: true,
  photoIssues: ["unreadable"],
};

export async function analyzeDamage(image: Buffer, contentType: string): Promise<DamageAnalysis> {
  let photo: PreparedPhoto;
  try {
    photo = await prepareImage(image, contentType);
  } catch (err) {
    if (err instanceof UnreadablePhotoError) return UNREADABLE;
    throw err;
  }

  const ai = await generateJson({
    schema: DamageAnalysisSchema,
    system: SYSTEM,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: photo.jpeg.toString("base64") } },
          { text: "Identify the visible damage on this vehicle." },
        ],
      },
    ],
  });
  return {
    ...ai,
    damagedComponents: ai.damagedComponents.map(({ box_2d, ...c }) => {
      const [yMin, xMin, yMax, xMax] = (box_2d ?? []).map((v) => v / 1000);
      return xMin < xMax && yMin < yMax ? { ...c, box: { xMin, yMin, xMax, yMax } } : c;
    }),
    needsManualReview: ai.needsManualReview || photo.issues.length > 0,
    photoIssues: photo.issues,
  };
}
