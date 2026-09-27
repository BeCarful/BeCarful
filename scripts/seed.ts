// Fictional demo data. Run: npm run seed (needs MONGODB_URI, S3 and AUTH_SECRET in .env.local).
import mongoose, { type Types } from "mongoose";
import { hashPassword } from "@/lib/password";
import { connectDB } from "@/lib/db";
import { ChatMessage } from "@/models/ChatMessage";
import { DamageAssessment } from "@/models/DamageAssessment";
import { DamagePhoto } from "@/models/DamagePhoto";
import { Incident } from "@/models/Incident";
import { InsurancePolicy } from "@/models/InsurancePolicy";
import { User } from "@/models/User";
import { Vehicle } from "@/models/Vehicle";
import { env } from "@/lib/env";
import { refreshIncidentStatus } from "@/services/claims/state";
import { sealPhoto, sha256Hex } from "@/services/photos/seal";
import { carModel } from "@/services/vehicles/car-models";
import { makeKey, putObject } from "@/services/storage/gcs";
import type { CoverageItem } from "@/services/ai/coverage-rules";
import { NOT_FOUND_IN_POLICY, type DamagedComponent } from "@/types";

const cov = (peril: CoverageItem["peril"], status: CoverageItem["status"], detail: string): CoverageItem => ({ peril, status, detail, law: null });

const DEMO_EMAIL = "demo@becarful.app";
const DEMO_PASSWORD = "demo1234";
const HOUR = 60 * 60 * 1000;

function minimalPdf(lines: string[]): Buffer {
  const text = lines
    .map((l, i) => `BT /F1 11 Tf 50 ${750 - i * 18} Td (${l.replace(/[()\\]/g, "\\$&")}) Tj ET`)
    .join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

function placeholderPhoto(label: string, dent: { x: number; y: number }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" shape-rendering="crispEdges">
<rect width="320" height="240" fill="#7a8a99"/><rect y="170" width="320" height="70" fill="#4b5563"/>
<rect x="40" y="100" width="240" height="70" fill="#c0c7cf"/><rect x="90" y="64" width="140" height="40" fill="#aab3bd"/>
<rect x="104" y="72" width="52" height="28" fill="#3b82f6"/><rect x="164" y="72" width="52" height="28" fill="#3b82f6"/>
<rect x="60" y="160" width="40" height="40" fill="#111"/><rect x="220" y="160" width="40" height="40" fill="#111"/>
<rect x="${dent.x}" y="${dent.y}" width="36" height="20" fill="#e43b44"/><rect x="${dent.x + 8}" y="${dent.y + 6}" width="20" height="8" fill="#7f1d1d"/>
<rect x="8" y="8" width="304" height="22" fill="#1b1b2f"/><text x="16" y="24" font-family="monospace" font-size="12" fill="#fff">DEMO PHOTO · ${label}</text>
</svg>`;
}

async function uploadPhoto(userId: Types.ObjectId, vehicleId: Types.ObjectId, svg: string) {
  // Seed-only: real uploads are limited to JPEG/PNG/WebP. The key shape still matches makeKey.
  const key = makeKey("photos", userId.toString(), vehicleId.toString(), "image/png").replace(/\.png$/, ".svg");
  await putObject(key, svg, "image/svg+xml");
  return key;
}

const catalogCar = (id: string) => {
  const m = carModel(id);
  return { modelId: m.id, year: m.year, make: m.make, model: m.model };
};
const PEUGEOT = catalogCar("peugeot-308");
const LAMBO = catalogCar("lamborghini-sc18");
const title = (c: typeof PEUGEOT) => `${c.year} ${c.make} ${c.model}`;

async function main() {
  await connectDB();

  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    const q = { userId: existing._id };
    await Promise.all([
      Vehicle.deleteMany(q),
      InsurancePolicy.deleteMany(q),
      Incident.deleteMany(q),
      DamagePhoto.deleteMany(q),
      DamageAssessment.deleteMany(q),
      ChatMessage.deleteMany(q),
    ]);
    await existing.deleteOne();
  }

  const user = await User.create({ email: DEMO_EMAIL, name: "Alex Rivera", passwordHash: await hashPassword(DEMO_PASSWORD) });
  const peugeot = await Vehicle.create({
    userId: user._id,
    ...PEUGEOT,
    color: "Artense Grey",
    vin: "VF3LBYHZPMS000001",
    licensePlate: "BCF2021",
    state: "TX",
  });
  const lambo = await Vehicle.create({
    userId: user._id,
    ...LAMBO,
    color: "Rosso Mars",
    licensePlate: "SC18ALS",
    state: "CA",
  });
  user.lastVehicleId = peugeot._id;
  await user.save();

  const sfKey = makeKey("policies", user._id.toString(), peugeot._id.toString(), "application/pdf");
  await putObject(
    sfKey,
    minimalPdf([
      "DEMO DOCUMENT - FICTIONAL POLICY FOR BECARFUL",
      "State Farm Personal Auto Policy (sample)",
      "Policy number: SF-DEMO-000123",
      "Named insured: Alex Rivera",
      `Vehicle: ${title(PEUGEOT)}`,
      "Policy period: 2026-03-01 to 2026-09-01",
      "Total premium: $642.18 per 6 months",
      "Liability: $100,000 / $300,000 bodily injury; $100,000 property damage",
      "Collision: covered, $500 deductible",
      "Comprehensive: covered, $250 deductible",
      "Rental reimbursement: $40/day up to $1,200",
      "Emergency road service: included",
      "Exclusions: racing, commercial ride-share use, intentional damage",
    ]),
    "application/pdf",
  );
  const peugeotPolicy = await InsurancePolicy.create({
    userId: user._id,
    vehicleId: peugeot._id,
    providerId: "state-farm",
    s3Key: sfKey,
    fileName: "state-farm-policy-demo.pdf",
    uploadedAt: new Date(Date.now() - 30 * 24 * HOUR),
    status: "processed",
    extractedData: {
      provider: "State Farm",
      policyNumber: "SF-DEMO-000123",
      policyType: "Personal auto",
      effectiveDates: "2026-03-01 to 2026-09-01",
      premium: "$642.18 per 6 months",
      coveredVehicle: title(PEUGEOT),
      collision: "Covered, $500 deductible",
      comprehensive: "Covered, $250 deductible",
      liability: "$100,000 / $300,000 bodily injury; $100,000 property damage",
      deductibles: "Collision $500; Comprehensive $250",
      rentalReimbursement: "$40/day up to $1,200",
      roadsideAssistance: "Emergency road service included",
      otherCoverage: [],
      exclusions: ["Racing", "Commercial ride-share use", "Intentional damage"],
    },
    coverageChecklist: {
      generatedAt: new Date(),
      items: [
        cov("collision", "covered", "Covered by collision, $500 deductible."),
        cov("liability", "covered", "$100,000 / $300,000 bodily injury; $100,000 property damage."),
        cov("injury", "unknown", NOT_FOUND_IN_POLICY),
        cov("uninsured_driver", "unknown", NOT_FOUND_IN_POLICY),
        cov("theft", "covered", "Covered by comprehensive, $250 deductible."),
        cov("fire", "covered", "Covered by comprehensive, $250 deductible."),
        cov("flood", "covered", "Covered by comprehensive, $250 deductible."),
        cov("storm", "covered", "Covered by comprehensive, $250 deductible."),
        cov("vandalism", "covered", "Covered by comprehensive; intentional damage by you is excluded."),
        cov("animal", "covered", "Covered by comprehensive, $250 deductible."),
        cov("glass", "covered", "Covered by comprehensive, $250 deductible."),
        cov("roadside", "covered", "Emergency road service included."),
      ],
    },
    aiSummary:
      "Your Peugeot has collision coverage with a $500 deductible, so a crash repair like this is likely covered after you pay the first $500. Rental cars are covered up to $40/day. Racing and ride-share use are excluded.",
  });

  const lamboKey = makeKey("policies", user._id.toString(), lambo._id.toString(), "application/pdf");
  await putObject(
    lamboKey,
    minimalPdf([
      "DEMO DOCUMENT - FICTIONAL POLICY FOR BECARFUL",
      "GEICO Auto Policy (sample)",
      "Policy number: GC-DEMO-778899",
      `Vehicle: ${title(LAMBO)}`,
      "Liability: $50,000 / $100,000 bodily injury; $50,000 property damage",
      "Collision: covered, $1,000 deductible",
    ]),
    "application/pdf",
  );
  await InsurancePolicy.create({
    userId: user._id,
    vehicleId: lambo._id,
    providerId: "geico",
    s3Key: lamboKey,
    fileName: "geico-policy-demo.pdf",
    status: "processed",
    extractedData: {
      provider: "GEICO",
      policyNumber: "GC-DEMO-778899",
      policyType: "Personal auto",
      effectiveDates: null,
      premium: null,
      coveredVehicle: title(LAMBO),
      collision: "Covered, $1,000 deductible",
      comprehensive: null,
      liability: "$50,000 / $100,000 bodily injury; $50,000 property damage",
      deductibles: "Collision $1,000",
      rentalReimbursement: null,
      roadsideAssistance: null,
      otherCoverage: [],
      exclusions: [],
    },
    coverageChecklist: {
      generatedAt: new Date(),
      items: [
        cov("collision", "covered", "Covered by collision, $1,000 deductible."),
        cov("liability", "covered", "$50,000 / $100,000 bodily injury; $50,000 property damage."),
        cov("injury", "unknown", NOT_FOUND_IN_POLICY),
        cov("uninsured_driver", "unknown", NOT_FOUND_IN_POLICY),
        cov("theft", "unknown", "No comprehensive coverage found, so theft likely isn't covered."),
        cov("fire", "unknown", "No comprehensive coverage found, so fire likely isn't covered."),
        cov("flood", "unknown", "No comprehensive coverage found, so flood likely isn't covered."),
        cov("storm", "unknown", "No comprehensive coverage found, so hail and wind likely aren't covered."),
        cov("vandalism", "unknown", NOT_FOUND_IN_POLICY),
        cov("animal", "unknown", NOT_FOUND_IN_POLICY),
        cov("glass", "unknown", NOT_FOUND_IN_POLICY),
        cov("roadside", "unknown", NOT_FOUND_IN_POLICY),
      ],
    },
    aiSummary:
      "Your Lamborghini has liability and collision coverage with a $1,000 collision deductible. Comprehensive, rental and roadside coverage were not found in the uploaded policy.",
  });

  const occurredAt = new Date(Date.now() - 26 * HOUR);
  const incident = await Incident.create({
    userId: user._id,
    vehicleId: peugeot._id,
    insurancePolicyId: peugeotPolicy._id,
    type: "collision",
    occurredAt,
    location: "Lamar Blvd & W 5th St, Austin, TX",
    notes: "Another car clipped my front-left corner while merging.",
    status: "documenting",
  });

  const photos: { label: string; dent: { x: number; y: number }; located: boolean; damage: DamagedComponent[]; summary: string }[] = [
    {
      label: "front-left close-up",
      dent: { x: 44, y: 110 },
      located: true,
      damage: [
        { component: "front_left_fender", damageTypes: ["dent", "scratch"], severity: "moderate", confidence: 0.88, description: "Visible dent and paint damage above the wheel arch" },
        { component: "front_bumper", damageTypes: ["scratch"], severity: "minor", confidence: 0.74, description: "Scuffs on the left corner of the bumper" },
      ],
      summary: "Dent and scratches around the front-left fender and bumper corner.",
    },
    {
      label: "front-left headlight",
      dent: { x: 44, y: 128 },
      located: true,
      damage: [
        { component: "left_headlight", damageTypes: ["crack"], severity: "minor", confidence: 0.66, description: "Hairline crack in the headlight lens" },
        { component: "front_left_fender", damageTypes: ["dent"], severity: "moderate", confidence: 0.81, description: "Dent visible from a lower angle" },
      ],
      summary: "Cracked left headlight lens next to the dented fender.",
    },
    {
      label: "wide shot, driver side",
      dent: { x: 60, y: 120 },
      located: false,
      damage: [
        { component: "front_left_door", damageTypes: ["scratch"], severity: "minor", confidence: 0.61, description: "Light scratch on the leading edge of the door" },
      ],
      summary: "Wide view shows the damage is limited to the front-left area.",
    },
  ];

  for (const [i, p] of photos.entries()) {
    const at = new Date(occurredAt.getTime() + (i + 1) * 5 * 60 * 1000);
    const svg = placeholderPhoto(p.label, p.dent);
    const evidence = {
      sha256: sha256Hex(svg),
      capturedAt: at,
      serverReceivedAt: new Date(at.getTime() + 4000),
      ...(p.located ? { latitude: 30.2686, longitude: -97.7555, locationAccuracy: 12 } : {}),
    };
    const photo = await DamagePhoto.create({
      userId: user._id,
      vehicleId: peugeot._id,
      incidentId: incident._id,
      s3Key: await uploadPhoto(user._id, peugeot._id, svg),
      contentType: "image/svg+xml",
      source: "camera",
      ...evidence,
      seal: sealPhoto({ vehicleId: peugeot.id, ...evidence }, env().AUTH_SECRET),
      analysisStatus: "done",
    });
    await DamageAssessment.create({
      userId: user._id,
      vehicleId: peugeot._id,
      incidentId: incident._id,
      photoId: photo._id,
      damagedComponents: p.damage,
      summary: p.summary,
      needsManualReview: false,
      aiModel: "seed",
    });
  }

  const chat: [("user" | "assistant"), string][] = [
    ["user", "Someone clipped my front left corner. Am I covered?"],
    ["assistant", "Sorry that happened! Your State Farm policy lists collision coverage with a $500 deductible, so this kind of damage is likely covered after the deductible. State Farm makes the final call."],
    ["user", "Do I need more photos?"],
    ["assistant", "You have 3 photos of the front-left area, which covers the basics. A close-up of the headlight crack in daylight would help too."],
  ];
  for (const [i, [role, content]] of chat.entries()) {
    await ChatMessage.create({ userId: user._id, vehicleId: peugeot._id, role, content, createdAt: new Date(Date.now() - (chat.length - i) * 60_000) });
  }

  await refreshIncidentStatus(user._id, peugeot._id);
  await refreshIncidentStatus(user._id, lambo._id);

  console.log(`Seeded ${DEMO_EMAIL} / ${DEMO_PASSWORD} with a ${title(PEUGEOT)} and a ${title(LAMBO)}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
