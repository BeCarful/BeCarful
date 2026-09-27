import { describe, expect, it } from "vitest";

import type { AssessmentV1 } from "./assessment-api";
import { describeAssessmentOutcome } from "./assessment-outcome";

function assessment(overrides: Partial<AssessmentV1> = {}): AssessmentV1 {
  return {
    schema_version: "1.0",
    claim_id: "clm_test",
    analysis_run_id: "run_test",
    status: "needs_human_review",
    findings: [],
    coverage: { missing: [], complete: true },
    review_reasons: ["confidence_unvalidated"],
    limitations: [],
    ...overrides,
  };
}

describe("describeAssessmentOutcome", () => {
  it("labels the sample report before any assessment starts", () => {
    expect(describeAssessmentOutcome(null, false)).toEqual({
      statusLabel: "Sample data",
      emptyMessage: "No visible damage findings.",
      notAssessedReason: null,
    });
  });

  it("shows progress while an assessment is running", () => {
    const outcome = describeAssessmentOutcome(null, true);

    expect(outcome.statusLabel).toBe("Analyzing");
    expect(outcome.emptyMessage).toBe("Assessment in progress…");
  });

  it("reports no damage only when damage was actually assessed", () => {
    const outcome = describeAssessmentOutcome(assessment(), true);

    expect(outcome.statusLabel).toBe("Gemini result");
    expect(outcome.emptyMessage).toBe("No visible damage findings.");
    expect(outcome.notAssessedReason).toBeNull();
  });

  it("does not report 'no damage' when the photos show different vehicles", () => {
    const outcome = describeAssessmentOutcome(
      assessment({
        review_reasons: ["vehicle_inconsistency", "confidence_unvalidated"],
      }),
      true,
    );

    expect(outcome.statusLabel).toBe("Vehicle mismatch");
    expect(outcome.emptyMessage).toMatch(/not assessed.*different vehicles/);
    expect(outcome.notAssessedReason).toBe(outcome.emptyMessage);
  });

  it("asks for missing views when no photo was usable", () => {
    const outcome = describeAssessmentOutcome(
      assessment({
        status: "needs_more_photos",
        coverage: { missing: ["front"], complete: false },
      }),
      true,
    );

    expect(outcome.statusLabel).toBe("Coverage incomplete");
    expect(outcome.emptyMessage).toMatch(/add the missing vehicle views/);
  });
});
