"use client";

import { useCallback, useState } from "react";

import type { PartId } from "@/lib/car/car-parts";

export type ViewerState = {
  isAutoRotating: boolean;
  areDoorsOpen: boolean;
  /** Increments on every reset request; the scene resets the camera when it changes. */
  resetToken: number;
  selectedPartId: PartId | null;
  toggleAutoRotate: () => void;
  toggleDoors: () => void;
  resetView: () => void;
  /** Selects a part; selecting the already-selected part (or null) clears the selection. */
  selectPart: (partId: PartId | null) => void;
};

/**
 * Holds the UI state shared between the 3D scene, the damage panel and the controls.
 */
export function useViewerState(): ViewerState {
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [areDoorsOpen, setAreDoorsOpen] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [selectedPartId, setSelectedPartId] = useState<PartId | null>(null);

  const toggleAutoRotate = useCallback(() => {
    setIsAutoRotating((current) => !current);
  }, []);

  const toggleDoors = useCallback(() => {
    setAreDoorsOpen((current) => !current);
  }, []);

  const resetView = useCallback(() => {
    setResetToken((current) => current + 1);
  }, []);

  const selectPart = useCallback((partId: PartId | null) => {
    setSelectedPartId((current) => (partId === current ? null : partId));
    if (partId) {
      // Why: a selected part should stay in view instead of spinning away.
      setIsAutoRotating(false);
    }
  }, []);

  return {
    isAutoRotating,
    areDoorsOpen,
    resetToken,
    selectedPartId,
    toggleAutoRotate,
    toggleDoors,
    resetView,
    selectPart,
  };
}
