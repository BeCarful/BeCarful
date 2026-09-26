import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { DamageAssessment } from "@/models/DamageAssessment";
import { aggregateDamage } from "./damage";

test("aggregateDamage reads real Mongoose subdocuments", () => {
  const doc = new DamageAssessment({
    userId: new Types.ObjectId(),
    vehicleId: new Types.ObjectId(),
    incidentId: new Types.ObjectId(),
    photoId: new Types.ObjectId(),
    damagedComponents: [{ component: "hood", damageTypes: ["dent"], severity: "severe", confidence: 0.9, description: "Crushed" }],
  });
  const [d] = aggregateDamage([{ photoId: doc.photoId, damagedComponents: doc.damagedComponents as never }]);
  assert.equal(d.component, "hood");
  assert.equal(d.severity, "severe");
  assert.deepEqual(d.damageTypes, ["dent"]);
});
