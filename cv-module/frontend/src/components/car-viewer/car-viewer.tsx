"use client";

import dynamic from "next/dynamic";

import { useViewerState } from "@/hooks/use-viewer-state";

import styles from "./car-viewer.module.css";
import { ViewerControls } from "./viewer-controls";

// Why: WebGL needs the browser's `window`, so the canvas must skip server rendering.
const CarScene = dynamic(() => import("./car-scene"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading 3D…</p>,
});

/**
 * Full-screen 3D car viewer with a title and a small control bar.
 */
export function CarViewer() {
  const viewer = useViewerState();

  return (
    <main className={styles.viewer}>
      <CarScene
        isAutoRotating={viewer.isAutoRotating}
        areDoorsOpen={viewer.areDoorsOpen}
        resetToken={viewer.resetToken}
      />
      <header className={styles.header}>
        <h1 className={styles.title}>Suzuki XL7</h1>
        <p className={styles.subtitle}>
          Preview · drag to rotate, scroll to zoom
        </p>
      </header>
      <ViewerControls
        isAutoRotating={viewer.isAutoRotating}
        areDoorsOpen={viewer.areDoorsOpen}
        onToggleAutoRotate={viewer.toggleAutoRotate}
        onToggleDoors={viewer.toggleDoors}
        onResetView={viewer.resetView}
      />
    </main>
  );
}
