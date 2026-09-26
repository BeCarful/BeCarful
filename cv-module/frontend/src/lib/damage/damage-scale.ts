/**
 * Damage severity scale, shown like a pain scale: green (lowest) to dark red (highest).
 *
 * Change DAMAGE_LEVEL_COUNT to use a different number of levels; the colors are
 * spread evenly across the anchor colors, so no other code needs to change.
 */

export const DAMAGE_LEVEL_COUNT = 6;

/** Colors the scale runs through, from lowest to highest damage. */
export const DAMAGE_SCALE_ANCHORS = [
  "#2e9d45", // green
  "#8cc63f", // light green
  "#f5c518", // yellow
  "#f28c28", // orange
  "#d7301f", // red
  "#7a0010", // dark red
] as const;

export type DamageLevel = {
  /** 1 is the lowest level, `levelCount` the highest. */
  level: number;
  color: string;
  /** Lowest score (inclusive) that falls in this level. */
  minScore: number;
  /** Highest score for this level (exclusive, except the top level, which includes 1). */
  maxScore: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([red, green, blue]: [number, number, number]): string {
  const toHex = (channel: number) =>
    Math.round(channel).toString(16).padStart(2, "0");
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

/**
 * Returns the color at position `t` (0 to 1) along the anchor colors.
 */
export function colorAlongScale(
  t: number,
  anchors: readonly string[] = DAMAGE_SCALE_ANCHORS,
): string {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (anchors.length - 1);
  const lowerIndex = Math.min(Math.floor(scaled), anchors.length - 2);
  const mix = scaled - lowerIndex;
  const from = hexToRgb(anchors[lowerIndex]);
  const to = hexToRgb(anchors[lowerIndex + 1]);
  return rgbToHex(
    [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * mix) as [
      number,
      number,
      number,
    ],
  );
}

/**
 * Builds the list of levels, each with its color and score range.
 */
export function buildDamageScale(
  levelCount: number = DAMAGE_LEVEL_COUNT,
): DamageLevel[] {
  if (!Number.isInteger(levelCount) || levelCount < 2) {
    throw new Error(
      `Damage scale needs a whole number of levels >= 2, got ${levelCount}`,
    );
  }
  return Array.from({ length: levelCount }, (_, index) => ({
    level: index + 1,
    color: colorAlongScale(index / (levelCount - 1)),
    minScore: index / levelCount,
    maxScore: (index + 1) / levelCount,
  }));
}

/**
 * Converts a damage score (0 to 1) into a level from 1 to `levelCount`.
 * The range is split into equal bands; a score of exactly 1 is the top level.
 */
export function scoreToLevel(
  score: number,
  levelCount: number = DAMAGE_LEVEL_COUNT,
): number {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(`Damage score must be between 0 and 1, got ${score}`);
  }
  return Math.min(levelCount, Math.floor(score * levelCount) + 1);
}
