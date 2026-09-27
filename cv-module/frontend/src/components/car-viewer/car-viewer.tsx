"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { useViewerState } from "@/hooks/use-viewer-state";
import type { ClaimExportV1 } from "@/lib/assessment/assessment-api";
import { describeAssessmentOutcome } from "@/lib/assessment/assessment-outcome";
import {
  findingsToDamageReport,
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
import { AssessmentPanel } from "./assessment-panel";
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
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [assessmentStarted, setAssessmentStarted] = useState(false);
  const [assessmentBundle, setAssessmentBundle] =
    useState<ClaimExportV1 | null>(null);
  const scale = useMemo(() => buildDamageScale(DAMAGE_LEVEL_COUNT), []);
  const damageReport = useMemo(() => {
    if (assessmentBundle) {
      return findingsToDamageReport(assessmentBundle.assessment.findings);
    }
    if (assessmentStarted) {
      return { parts: [] };
    }
    return parseDamageReport(SAMPLE_DAMAGE_REPORT);
  }, [assessmentBundle, assessmentStarted]);
  const damageByPart = useMemo(
    () => resolveDamage(damageReport, scale),
    [damageReport, scale],
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

  const outcome = describeAssessmentOutcome(
    assessmentBundle?.assessment ?? null,
    assessmentStarted,
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
          statusLabel={outcome.statusLabel}
          emptyMessage={outcome.emptyMessage}
        />
        {isAssessmentOpen && (
          <AssessmentPanel
            onAssessmentStarted={() => {
              setAssessmentStarted(true);
              setAssessmentBundle(null);
            }}
            onAssessmentReady={setAssessmentBundle}
          />
        )}
        <ViewerControls
          isAutoRotating={viewer.isAutoRotating}
          areDoorsOpen={viewer.areDoorsOpen}
          isAssessmentOpen={isAssessmentOpen}
          onToggleAutoRotate={viewer.toggleAutoRotate}
          onToggleDoors={viewer.toggleDoors}
          onResetView={viewer.resetView}
          onToggleAssessment={() => setIsAssessmentOpen((open) => !open)}
        />
      </main>
    </DamageContext>
  );
}
