"use client";

import styles from "./car-viewer.module.css";

type ViewerControlsProps = {
  isAutoRotating: boolean;
  areDoorsOpen: boolean;
  onToggleAutoRotate: () => void;
  onToggleDoors: () => void;
  onResetView: () => void;
};

/**
 * The row of buttons under the car: auto-rotate, reset camera, open/close doors.
 */
export function ViewerControls({
  isAutoRotating,
  areDoorsOpen,
  onToggleAutoRotate,
  onToggleDoors,
  onResetView,
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
    </div>
  );
}
