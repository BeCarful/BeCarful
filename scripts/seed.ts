// Fictional demo data. Run: npm run seed (needs MONGODB_URI, S3 and AUTH_SECRET in .env.local).
import mongoose, { type Types } from "mongoose";
import sharp from "sharp";
import { hashPassword } from "@/lib/password";
import { connectDB } from "@/lib/db";
import { ChatMessage } from "@/models/ChatMessage";
import { DamageAssessment } from "@/models/DamageAssessment";
import { DamagePhoto } from "@/models/DamagePhoto";
import { EvidenceShare } from "@/models/EvidenceShare";
import { Incident } from "@/models/Incident";
import { InsurancePolicy } from "@/models/InsurancePolicy";
import { User } from "@/models/User";
import { Vehicle } from "@/models/Vehicle";
import { env } from "@/lib/env";
import { getOrCreateOpenIncident, refreshIncidentStatus } from "@/services/claims/state";
import { sealPhoto, sha256Hex } from "@/services/photos/seal";
import { carModel } from "@/services/vehicles/car-models";
import { deleteObject, deleteVehicleObjects, makeKey, putObject } from "@/services/storage/gcs";
import type { CoverageItem } from "@/services/ai/coverage-rules";
import { NOT_FOUND_IN_POLICY, type VehicleView } from "@/types";

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

const PHOTO_DIR = "data/peugeot-308";
const HOME = { latitude: 30.2849, longitude: -97.7341, locationAccuracy: 9 };
const PEUGEOT_PLATE = "BCF2021";

type SeedPhoto = { file: string; view: VehicleView; summary: string };

const WALKAROUND: SeedPhoto[] = [
  { file: "normal/front.png", view: "front", summary: "The front looks clean. No visible damage." },
  { file: "normal/left-front.png", view: "front_left", summary: "The front half of the left side looks clean. No visible damage." },
  { file: "normal/left-rear.png", view: "rear_left", summary: "The rear half of the left side looks clean. No visible damage." },
  { file: "normal/rear.png", view: "rear", summary: "The rear looks clean. No visible damage." },
  { file: "normal/right-rear.png", view: "rear_right", summary: "The rear half of the right side looks clean. No visible damage." },
  { file: "normal/right-front.png", view: "front_right", summary: "The front half of the right side looks clean. No visible damage." },
  { file: "normal/top.png", view: "unknown", summary: "Top view: the roof and glass look clean. No visible damage." },
];

const photoBytes = (p: SeedPhoto) => sharp(`${PHOTO_DIR}/${p.file}`).flatten().resize({ height: 1080 }).jpeg({ quality: 90 }).toBuffer();

async function seedPeugeotPhotos(userId: Types.ObjectId, vehicleId: Types.ObjectId, incidentId: Types.ObjectId, takenAt: Date) {
  const shots = WALKAROUND.map((p, i) => ({ ...p, at: new Date(takenAt.getTime() + i * 60_000) }));
  for (const p of shots) {
    const bytes = await photoBytes(p);
    const key = makeKey("photos", userId.toString(), vehicleId.toString(), "image/jpeg");
    await putObject(key, bytes, "image/jpeg");
    const evidence = {
      sha256: sha256Hex(bytes),
      capturedAt: p.at,
      serverReceivedAt: new Date(p.at.getTime() + 4000),
      ...HOME,
    };
    const photo = await DamagePhoto.create({
      userId,
      vehicleId,
      incidentId,
      s3Key: key,
      contentType: "image/jpeg",
      source: "camera",
      ...evidence,
      seal: sealPhoto({ vehicleId: vehicleId.toString(), ...evidence }, env().AUTH_SECRET),
      analysisStatus: "done",
    });
    await DamageAssessment.create({
      userId,
      vehicleId,
      incidentId,
      photoId: photo._id,
      view: p.view,
      damagedComponents: [],
      summary: p.summary,
      needsManualReview: false,
      aiModel: "seed",
    });
  }
}

async function reseedPeugeotPhotos() {
  const user = await User.findOne({ email: DEMO_EMAIL });
  const peugeot = user && (await Vehicle.findOne({ userId: user._id, licensePlate: PEUGEOT_PLATE }));
  if (!user || !peugeot) throw new Error("No demo Peugeot yet. Run npm run seed first.");
  const scope = { userId: user._id, vehicleId: peugeot._id };
  const seeded = await DamageAssessment.find({ ...scope, aiModel: "seed" });
  const old = await DamagePhoto.find({ ...scope, _id: { $in: seeded.map((a) => a.photoId) } });
  await Promise.all(old.map((p) => deleteObject(p.s3Key)));
  await DamagePhoto.deleteMany({ ...scope, _id: { $in: old.map((p) => p._id) } });
  await DamageAssessment.deleteMany({ ...scope, _id: { $in: seeded.map((a) => a._id) } });

  const incident = await getOrCreateOpenIncident(user._id, peugeot._id);
  await seedPeugeotPhotos(user._id, peugeot._id, incident._id, new Date(Date.now() - 2 * 24 * HOUR));
  await refreshIncidentStatus(user._id, peugeot._id);
  console.log(`Reseeded ${old.length} → ${WALKAROUND.length} photos on ${DEMO_EMAIL}'s ${title(PEUGEOT)} (${PEUGEOT_PLATE}).`);
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
  if (process.argv.includes("--peugeot")) return reseedPeugeotPhotos();

  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (existing) {
    const q = { userId: existing._id };
    const old = await Vehicle.find(q).select("_id");
    await Promise.all(old.map((v) => deleteVehicleObjects(existing._id.toString(), v._id.toString())));
    await Promise.all([
      EvidenceShare.deleteMany(q),
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
    nickname: "Daily Pug",
    color: "Artense Grey",
    vin: "VF3LBYHZPMS000001",
    licensePlate: PEUGEOT_PLATE,
    state: "TX",
  });
  const lambo = await Vehicle.create({
    userId: user._id,
    ...LAMBO,
    nickname: "The Bull",
    color: "Rosso Mars",
    licensePlate: "SC18ALS",
    state: "CA",
  });
  user.lastVehicleId = peugeot._id;
  await user.save();

  const day = (offset: number) => new Date(Date.now() + offset * 24 * HOUR).toISOString().slice(0, 10);
  const policyPeriod = `${day(-60)} to ${day(122)}`;
  const sfKey = makeKey("policies", user._id.toString(), peugeot._id.toString(), "application/pdf");
  await putObject(
    sfKey,
    minimalPdf([
      "DEMO DOCUMENT - FICTIONAL POLICY FOR BECARFUL",
      "State Farm Personal Auto Policy (sample)",
      "Policy number: SF-DEMO-000123",
      "Named insured: Alex Rivera",
      `Vehicle: ${title(PEUGEOT)}`,
      `Policy period: ${policyPeriod}`,
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
  await InsurancePolicy.create({
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
      effectiveDates: policyPeriod,
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
      formNumbers: ["9810C"],
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
      "Your Peugeot has collision coverage with a $500 deductible and comprehensive with a $250 deductible, so crashes, theft, hail and flood are covered after you pay the deductible. Rental cars are covered up to $40/day. Racing and ride-share use are excluded.",
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

  const incident = await Incident.create({ userId: user._id, vehicleId: peugeot._id, status: "documenting" });
  await seedPeugeotPhotos(user._id, peugeot._id, incident._id, new Date(Date.now() - 2 * 24 * HOUR));

  const chat: [("user" | "assistant"), string][] = [
    ["user", "What does my insurance cover?"],
    ["assistant", "Your State Farm policy covers collision ($500 deductible), comprehensive ($250 deductible: theft, fire, flood, hail, vandalism, animals, glass), liability, rental up to $40/day and roadside help. State Farm makes the final call on any claim."],
    ["user", "Is there anything else I should do?"],
    ["assistant", "You're in good shape: your walkaround from two days ago shows every side clean, so if something happens you can prove the car's condition before. If you're ever in a crash, open Crash mode."],
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
