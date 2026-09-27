import type { AssessmentV1 } from "./assessment-api";

/** Labels the damage panel shows for the current assessment state. */
export type AssessmentOutcome = {
  statusLabel: string;
  emptyMessage: string;
  /** Explains why damage was not assessed, or `null` when it was assessed. */
  notAssessedReason: string | null;
};

/**
 * Backend `ReviewReason` that means the photos show different vehicles.
 * The backend then skips damage inference, so an empty findings list does
 * not mean "no damage".
 */
export const VEHICLE_INCONSISTENCY = "vehicle_inconsistency";

const VEHICLE_MISMATCH_MESSAGE =
  "Damage not assessed — the photos appear to show different vehicles. Submit photos of one vehicle.";
const MISSING_VIEWS_MESSAGE =
  "Damage not assessed — add the missing vehicle views.";

/**
 * Describes an assessment for the damage panel.
 *
 * @param assessment The validated assessment, or `null` when none is loaded.
 * @param isStarted Whether the user has started an assessment in this session.
 */
export function describeAssessmentOutcome(
  assessment: AssessmentV1 | null,
  isStarted: boolean,
): AssessmentOutcome {
  if (!assessment) {
    return isStarted
      ? {
          statusLabel: "Analyzing",
          emptyMessage: "Assessment in progress…",
          notAssessedReason: null,
        }
      : {
          statusLabel: "Sample data",
          emptyMessage: "No visible damage findings.",
          notAssessedReason: null,
        };
  }
  if (assessment.review_reasons.includes(VEHICLE_INCONSISTENCY)) {
    return {
      statusLabel: "Vehicle mismatch",
      emptyMessage: VEHICLE_MISMATCH_MESSAGE,
      notAssessedReason: VEHICLE_MISMATCH_MESSAGE,
    };
  }
  if (assessment.status === "needs_more_photos") {
    return {
      statusLabel: "Coverage incomplete",
      emptyMessage: MISSING_VIEWS_MESSAGE,
      notAssessedReason: MISSING_VIEWS_MESSAGE,
    };
  }
  return {
    statusLabel: "Gemini result",
    emptyMessage: "No visible damage findings.",
    notAssessedReason: null,
  };
}
