"use client";

import styles from "./car-viewer.module.css";

type ViewerControlsProps = {
  isAutoRotating: boolean;
  areDoorsOpen: boolean;
  isAssessmentOpen: boolean;
  onToggleAutoRotate: () => void;
  onToggleDoors: () => void;
  onResetView: () => void;
  onToggleAssessment: () => void;
};

/**
 * The row of car controls and the development camera-upload trigger.
 */
export function ViewerControls({
  isAutoRotating,
  areDoorsOpen,
  isAssessmentOpen,
  onToggleAutoRotate,
  onToggleDoors,
  onResetView,
  onToggleAssessment,
}: ViewerControlsProps) {
  return (
    <div
      className={styles.controls}
      role="toolbar"
      aria-label="Car viewer controls"
    >
      <button
        type="button"
        className={styles.button}
        aria-pressed={isAutoRotating}
        onClick={onToggleAutoRotate}
      >
        Auto-rotate: {isAutoRotating ? "On" : "Off"}
      </button>
      <button type="button" className={styles.button} onClick={onResetView}>
        Reset view
      </button>
      <button
        type="button"
        className={styles.button}
        aria-pressed={areDoorsOpen}
        onClick={onToggleDoors}
      >
        {areDoorsOpen ? "Close doors" : "Open doors"}
      </button>
      <button
        type="button"
        className={styles.button}
        aria-pressed={isAssessmentOpen}
        onClick={onToggleAssessment}
      >
        {isAssessmentOpen ? "Hide assessment" : "Assess photos"}
      </button>
    </div>
  );
}
