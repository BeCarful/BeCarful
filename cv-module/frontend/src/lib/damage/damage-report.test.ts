import { describe, expect, it } from "vitest";

import {
  findingsToDamageReport,
  parseDamageReport,
  resolveDamage,
  sortBySeverity,
} from "./damage-report";
import { buildDamageScale } from "./damage-scale";
import { SAMPLE_DAMAGE_REPORT } from "./sample-damage-report";

describe("parseDamageReport", () => {
  it("accepts a valid report", () => {
    const report = parseDamageReport({
      parts: [{ partId: "hood", severity: "minor", damageTypes: ["scratch"] }],
    });
    expect(report.parts).toEqual([
      { partId: "hood", severity: "minor", damageTypes: ["scratch"] },
    ]);
  });

  it("rejects a missing parts array", () => {
    expect(() => parseDamageReport({})).toThrow("`parts` array");
    expect(() => parseDamageReport(null)).toThrow();
  });

  it("rejects unknown parts, severities, damage types and duplicates", () => {
    expect(() =>
      parseDamageReport({
        parts: [
          { partId: "spoiler", severity: "minor", damageTypes: ["scratch"] },
        ],
      }),
    ).toThrow("unknown partId");
    expect(() =>
      parseDamageReport({
        parts: [
          { partId: "hood", severity: "catastrophic", damageTypes: ["dent"] },
        ],
      }),
    ).toThrow("unknown severity");
    expect(() =>
      parseDamageReport({
        parts: [{ partId: "hood", severity: "minor", damageTypes: [4] }],
      }),
    ).toThrow("damageTypes must be strings");
    expect(() =>
      parseDamageReport({
        parts: [
          { partId: "hood", severity: "minor", damageTypes: ["scratch"] },
          { partId: "hood", severity: "severe", damageTypes: ["dent"] },
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
      {
        parts: [
          { partId: "grille", severity: "severe", damageTypes: ["crack"] },
        ],
      },
      scale,
    );

    expect(damage.get("grille")).toEqual({
      partId: "grille",
      severity: "severe",
      damageTypes: ["crack"],
      level: 6,
      color: scale[5].color,
    });
  });

  it("sorts the most severe part first", () => {
    const damage = resolveDamage({
      parts: [
        { partId: "hood", severity: "minor", damageTypes: ["scratch"] },
        { partId: "roof", severity: "severe", damageTypes: ["dent"] },
      ],
    });
    expect(sortBySeverity(damage).map((part) => part.partId)).toEqual([
      "roof",
      "hood",
    ]);
  });

  it("groups findings by part and keeps the maximum severity", () => {
    expect(
      findingsToDamageReport([
        {
          part_id: "hood",
          damage_type: "scratch",
          visual_severity: "minor",
        },
        {
          part_id: "hood",
          damage_type: "dent",
          visual_severity: "severe",
        },
      ]),
    ).toEqual({
      parts: [
        {
          partId: "hood",
          severity: "severe",
          damageTypes: ["scratch", "dent"],
        },
      ],
    });
  });
});
