"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { useViewerState } from "@/hooks/use-viewer-state";
import {
  parseDamageReport,
  resolveDamage,
  sortBySeverity,
} from "@/lib/damage/damage-report";
import {
  buildDamageScale,
  DAMAGE_LEVEL_COUNT,
} from "@/lib/damage/damage-scale";
import { SAMPLE_DAMAGE_REPORT } from "@/lib/damage/sample-damage-report";

import styles from "./car-viewer.module.css";
import { DamageContext, type DamageContextValue } from "./damage-context";
import { DamagePanel } from "./damage-panel";
import { ViewerControls } from "./viewer-controls";

// Why: WebGL needs the browser's `window`, so the canvas must skip server rendering.
const CarScene = dynamic(() => import("./car-scene"), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading 3D…</p>,
});

/**
 * Full-screen 3D car viewer: the car colored by damage level, a damage panel,
 * a title and a small control bar.
 */
export function CarViewer() {
  const viewer = useViewerState();
  const scale = useMemo(() => buildDamageScale(DAMAGE_LEVEL_COUNT), []);
  const damageByPart = useMemo(
    () => resolveDamage(parseDamageReport(SAMPLE_DAMAGE_REPORT), scale),
    [scale],
  );
  const damagedParts = useMemo(
    () => sortBySeverity(damageByPart),
    [damageByPart],
  );

  const damageContext = useMemo<DamageContextValue>(
    () => ({
      damageByPart,
      selectedPartId: viewer.selectedPartId,
      selectPart: viewer.selectPart,
    }),
    [damageByPart, viewer.selectedPartId, viewer.selectPart],
  );

  return (
    <DamageContext value={damageContext}>
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
        <DamagePanel
          scale={scale}
          damagedParts={damagedParts}
          selectedPartId={viewer.selectedPartId}
          onSelectPart={viewer.selectPart}
          isSampleData
        />
        <ViewerControls
          isAutoRotating={viewer.isAutoRotating}
          areDoorsOpen={viewer.areDoorsOpen}
          onToggleAutoRotate={viewer.toggleAutoRotate}
          onToggleDoors={viewer.toggleDoors}
          onResetView={viewer.resetView}
        />
      </main>
    </DamageContext>
  );
}
