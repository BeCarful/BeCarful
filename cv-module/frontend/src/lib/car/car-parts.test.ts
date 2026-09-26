import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isPartId, PART_IDS, PART_LABELS, sideName } from "./car-parts";

const BACKEND_ENUMS_PATH = path.resolve(
  __dirname,
  "../../../../src/cv_module/domain/enums.py",
);

/** Pulls the string values out of `class PartId(StrEnum)` in the backend. */
function readBackendPartIds(): string[] {
  const source = readFileSync(BACKEND_ENUMS_PATH, "utf8");
  const classBody = source.split("class PartId(StrEnum):")[1]?.split(/\n\S/)[0];
  if (!classBody) {
    throw new Error(`PartId enum not found in ${BACKEND_ENUMS_PATH}`);
  }
  return [...classBody.matchAll(/=\s*"([a-z_]+)"/g)].map((match) => match[1]);
}

describe("car parts", () => {
  it("matches the backend PartId enum exactly", () => {
    expect([...PART_IDS].sort()).toEqual(readBackendPartIds().sort());
  });

  it("has a label for every part", () => {
    for (const partId of PART_IDS) {
      expect(PART_LABELS[partId]).toBeTruthy();
    }
  });

  it("recognises valid and invalid part IDs", () => {
    expect(isPartId("front_bumper")).toBe(true);
    expect(isPartId("spoiler")).toBe(false);
  });

  it("maps +z to the right side and -z to the left side", () => {
    expect(sideName(1)).toBe("right");
    expect(sideName(-1)).toBe("left");
  });
});
