"use client";

import { useCallback, useState } from "react";

export type ViewerState = {
  isAutoRotating: boolean;
  areDoorsOpen: boolean;
  /** Increments on every reset request; the scene resets the camera when it changes. */
  resetToken: number;
  toggleAutoRotate: () => void;
  toggleDoors: () => void;
  resetView: () => void;
};

/**
 * Holds the UI state shared between the 3D scene and the control buttons.
 */
export function useViewerState(): ViewerState {
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [areDoorsOpen, setAreDoorsOpen] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  const toggleAutoRotate = useCallback(() => {
    setIsAutoRotating((current) => !current);
  }, []);

  const toggleDoors = useCallback(() => {
    setAreDoorsOpen((current) => !current);
  }, []);

  const resetView = useCallback(() => {
    setResetToken((current) => current + 1);
  }, []);

  return {
    isAutoRotating,
    areDoorsOpen,
    resetToken,
    toggleAutoRotate,
    toggleDoors,
    resetView,
  };
}
