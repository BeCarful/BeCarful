import type { ClaimExportV1 } from "./assessment-api";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, name: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be a JSON object`);
  }
  return value as JsonRecord;
}

function asString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  return value;
}

function asBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean`);
  }
  return value;
}

function asStringArray(value: unknown, name: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new TypeError(`${name} must be a string array`);
  }
  return value;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function conciseConfidence(value: unknown): JsonRecord {
  const confidence = asRecord(value, "finding confidence");
  const result: JsonRecord = {
    band: asString(confidence.band, "confidence band"),
  };
  if (typeof confidence.score === "number") {
    result.score = confidence.score;
  }
  if (typeof confidence.calibration_version === "string") {
    result.calibration_version = confidence.calibration_version;
  }
  return result;
}

function conciseFinding(value: unknown): JsonRecord {
  const finding = asRecord(value, "finding");
  if (!Array.isArray(finding.evidence)) {
    throw new TypeError("finding evidence must be an array");
  }
  return {
    part_id: asString(finding.part_id, "finding part_id"),
    damage_type: asString(finding.damage_type, "finding damage_type"),
    visual_severity: asString(
      finding.visual_severity,
      "finding visual_severity",
    ),
    confidence: conciseConfidence(finding.confidence),
    evidence: finding.evidence,
  };
}

/** Serialize the user download without internal telemetry or derived duplicates. */
export function serializeClaimExport(bundle: ClaimExportV1): string {
  const assessment = bundle.assessment as JsonRecord;
  const processing = asRecord(assessment.processing, "assessment processing");
  const coverage = asRecord(assessment.coverage, "assessment coverage");
  if (!Array.isArray(assessment.images)) {
    throw new TypeError("assessment images must be an array");
  }
  if (!Array.isArray(assessment.findings)) {
    throw new TypeError("assessment findings must be an array");
  }

  const assessedImages = new Map(
    assessment.images.map((value) => {
      const image = asRecord(value, "assessment image");
      return [asString(image.image_id, "assessment image_id"), image] as const;
    }),
  );

  const concise = {
    export_schema_version: "2.0",
    claim_id: bundle.claim_id,
    analysis_run_id: bundle.analysis_run_id,
    images: bundle.source_images.map((source) => {
      const assessed = assessedImages.get(source.image_id);
      if (!assessed) {
        throw new TypeError(`missing assessment image ${source.image_id}`);
      }
      const qualityReasons = asStringArray(
        assessed.quality_reasons,
        "image quality_reasons",
      );
      return {
        image_id: source.image_id,
        ...(source.file_name === null ? {} : { file_name: source.file_name }),
        view: asString(assessed.view, "image view"),
        usable: asBoolean(assessed.usable, "image usable"),
        ...(qualityReasons.length === 0
          ? {}
          : { quality_reasons: qualityReasons }),
      };
    }),
    assessment: {
      status: bundle.assessment.status,
      model: {
        id: asString(processing.model_id, "model_id"),
        prompt_version: asString(processing.prompt_version, "prompt_version"),
      },
      coverage: {
        observed_views: asStringArray(
          coverage.observed,
          "coverage observed views",
        ),
        suggested_views: unique([
          ...asStringArray(coverage.missing, "coverage missing views"),
          ...asStringArray(
            coverage.recommended_missing,
            "coverage recommended views",
          ),
        ]),
      },
      findings: assessment.findings.map(conciseFinding),
      review_reasons: bundle.assessment.review_reasons,
      limitations: bundle.assessment.limitations,
    },
    raw_gemini: bundle.raw_gemini,
  };

  return JSON.stringify(concise, null, 2);
}
