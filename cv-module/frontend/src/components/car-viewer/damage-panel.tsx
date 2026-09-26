"use client";

import { PART_LABELS, type PartId } from "@/lib/car/car-parts";
import {
  severityToLevel,
  VISUAL_SEVERITIES,
  type ResolvedPartDamage,
} from "@/lib/damage/damage-report";
import type { DamageLevel } from "@/lib/damage/damage-scale";

import styles from "./damage-panel.module.css";

type DamagePanelProps = {
  scale: DamageLevel[];
  /** Damaged parts, most severe first. */
  damagedParts: ResolvedPartDamage[];
  selectedPartId: PartId | null;
  onSelectPart: (partId: PartId | null) => void;
  statusLabel: string | null;
  emptyMessage: string;
};

function titleCase(value: string): string {
  const spaced = value.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Card with the damage color legend and the list of damaged parts.
 * Clicking a row selects that part on the car; clicking it again clears it.
 */
export function DamagePanel({
  scale,
  damagedParts,
  selectedPartId,
  onSelectPart,
  statusLabel,
  emptyMessage,
}: DamagePanelProps) {
  const isSelectedPartUndamaged =
    selectedPartId !== null &&
    !damagedParts.some((part) => part.partId === selectedPartId);

  return (
    <section className={styles.panel} aria-label="Damage report">
      <header className={styles.header}>
        <h2 className={styles.title}>Damage</h2>
        {statusLabel && <span className={styles.badge}>{statusLabel}</span>}
      </header>

      <ol className={styles.legend} aria-label="Visual damage severity">
        {VISUAL_SEVERITIES.map((severity) => {
          const level = severityToLevel(severity, scale.length);
          return (
            <li
              key={severity}
              className={styles.legendStep}
              title={`${titleCase(severity)} visible damage`}
            >
              <span
                className={styles.legendSwatch}
                style={{ background: scale[level - 1].color }}
              />
              <span className={styles.legendNumber}>{titleCase(severity)}</span>
            </li>
          );
        })}
      </ol>
      <p className={styles.legendNote}>
        <span className={styles.undamagedSwatch} /> White: no damage reported
      </p>

      {damagedParts.length === 0 ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : (
        <ul className={styles.list}>
          {damagedParts.map((part) => {
            const isSelected = part.partId === selectedPartId;
            return (
              <li key={part.partId}>
                <button
                  type="button"
                  className={styles.row}
                  aria-pressed={isSelected}
                  onClick={() => onSelectPart(part.partId)}
                >
                  <span
                    className={styles.rowSwatch}
                    style={{ background: part.color }}
                  />
                  <span className={styles.rowLabel}>
                    {PART_LABELS[part.partId]}
                  </span>
                  <span className={styles.rowScore}>
                    {titleCase(part.severity)} ·{" "}
                    {part.damageTypes.map(titleCase).join(", ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {/* Why: shown below the list so it never shifts the rows under the cursor. */}
      {isSelectedPartUndamaged && (
        <p className={styles.selection}>
          <strong>{PART_LABELS[selectedPartId]}</strong> — no damage reported
        </p>
      )}
      <p className={styles.hint}>
        Click a part on the car or in the list to highlight it.
      </p>
    </section>
  );
}
