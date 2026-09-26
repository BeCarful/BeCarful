import { describe, expect, it } from "vitest";

import {
  buildDamageScale,
  colorAlongScale,
  DAMAGE_SCALE_ANCHORS,
  scoreToLevel,
} from "./damage-scale";

describe("buildDamageScale", () => {
  it("uses the anchor colors exactly for 6 levels, green to dark red", () => {
    const scale = buildDamageScale(6);

    expect(scale.map((level) => level.color)).toEqual([
      ...DAMAGE_SCALE_ANCHORS,
    ]);
    expect(scale[0]).toMatchObject({ level: 1, minScore: 0 });
    expect(scale[5]).toMatchObject({ level: 6, maxScore: 1 });
  });

  it("still starts green and ends dark red with a different level count", () => {
    for (const levelCount of [3, 5, 10]) {
      const scale = buildDamageScale(levelCount);
      expect(scale).toHaveLength(levelCount);
      expect(scale[0].color).toBe(DAMAGE_SCALE_ANCHORS[0]);
      expect(scale.at(-1)?.color).toBe(DAMAGE_SCALE_ANCHORS.at(-1));
    }
  });

  it("rejects fewer than 2 levels", () => {
    expect(() => buildDamageScale(1)).toThrow();
    expect(() => buildDamageScale(2.5)).toThrow();
  });
});

describe("colorAlongScale", () => {
  it("blends halfway between two anchors", () => {
    expect(colorAlongScale(0.5, ["#000000", "#ffffff"])).toBe("#808080");
  });
});

describe("scoreToLevel", () => {
  it("splits 0–1 into equal bands", () => {
    expect(scoreToLevel(0, 6)).toBe(1);
    expect(scoreToLevel(0.16, 6)).toBe(1);
    expect(scoreToLevel(0.17, 6)).toBe(2);
    expect(scoreToLevel(0.5, 6)).toBe(4);
    expect(scoreToLevel(0.99, 6)).toBe(6);
    expect(scoreToLevel(1, 6)).toBe(6);
  });

  it("rejects scores outside 0–1", () => {
    expect(() => scoreToLevel(-0.1)).toThrow();
    expect(() => scoreToLevel(1.2)).toThrow();
    expect(() => scoreToLevel(Number.NaN)).toThrow();
  });
});
