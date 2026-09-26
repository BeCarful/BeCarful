import { describe, expect, it } from "vitest";

import {
  parseDamageReport,
  resolveDamage,
  sortBySeverity,
} from "./damage-report";
import { buildDamageScale } from "./damage-scale";
import { SAMPLE_DAMAGE_REPORT } from "./sample-damage-report";

describe("parseDamageReport", () => {
  it("accepts a valid report", () => {
    const report = parseDamageReport({
      parts: [{ partId: "hood", score: 0.4 }],
    });
    expect(report.parts).toEqual([{ partId: "hood", score: 0.4 }]);
  });

  it("rejects a missing parts array", () => {
    expect(() => parseDamageReport({})).toThrow("`parts` array");
    expect(() => parseDamageReport(null)).toThrow();
  });

  it("rejects unknown parts, bad scores and duplicates", () => {
    expect(() =>
      parseDamageReport({ parts: [{ partId: "spoiler", score: 0.5 }] }),
    ).toThrow("unknown partId");
    expect(() =>
      parseDamageReport({ parts: [{ partId: "hood", score: 1.5 }] }),
    ).toThrow("score must be");
    expect(() =>
      parseDamageReport({
        parts: [
          { partId: "hood", score: 0.1 },
          { partId: "hood", score: 0.2 },
        ],
      }),
    ).toThrow("more than once");
  });

  it("accepts the sample report", () => {
    expect(() => parseDamageReport(SAMPLE_DAMAGE_REPORT)).not.toThrow();
  });
});

describe("resolveDamage", () => {
  it("adds the level and color for each part", () => {
    const scale = buildDamageScale(6);
    const damage = resolveDamage(
      { parts: [{ partId: "grille", score: 0.95 }] },
      scale,
    );

    expect(damage.get("grille")).toEqual({
      partId: "grille",
      score: 0.95,
      level: 6,
      color: scale[5].color,
    });
  });

  it("sorts the most severe part first", () => {
    const damage = resolveDamage({
      parts: [
        { partId: "hood", score: 0.2 },
        { partId: "roof", score: 0.9 },
      ],
    });
    expect(sortBySeverity(damage).map((part) => part.partId)).toEqual([
      "roof",
      "hood",
    ]);
  });
});
