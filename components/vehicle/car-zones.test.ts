import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPONENT_IDS } from "@/types";
import { classifyPoint, partKind } from "./car-zones";

test("partKind reads node and material names", () => {
  assert.equal(partKind(["polySurface1", "3DWheel Front L", "_rootJoint"], "Wheel1A"), "wheel");
  assert.equal(partKind(["Calliper Rear R_05"], "PaletteMaterial001"), "wheel");
  assert.equal(partKind(["Lambo:Window_Geo_lodA_red_glass_0"], "PaletteMaterial004"), "taillight");
  assert.equal(partKind(["Lambo:Window_Geo_lodA_light_glass_0"], "PaletteMaterial003"), "glass");
  assert.equal(partKind(["Lambo:Light_Geo_lodA_LightA_Material"], "LightA"), "light");
  assert.equal(partKind(["Lambo:Paint_Geo_lodA_Paint_0"], "PaletteMaterial006"), "body");
});

test("classifyPoint maps positions to component IDs", () => {
  const cases: [Parameters<typeof classifyPoint>, string][] = [
    [[{ f: 0.7, l: 0.9, h: 0.2 }, "wheel"], "front_left_wheel"],
    [[{ f: -0.7, l: -0.9, h: 0.2 }, "wheel"], "rear_right_wheel"],
    [[{ f: 0.95, l: 0.6, h: 0.4 }, "light"], "left_headlight"],
    [[{ f: -0.95, l: -0.6, h: 0.5 }, "light"], "right_taillight"],
    [[{ f: -0.9, l: 0.5, h: 0.5 }, "taillight"], "left_taillight"],
    [[{ f: 0.2, l: 0.1, h: 0.9 }, "glass"], "windshield"],
    [[{ f: -0.4, l: -0.1, h: 0.8 }, "glass"], "rear_window"],
    [[{ f: 0.1, l: 0.9, h: 0.7 }, "glass"], "front_left_door"],
    [[{ f: 0.95, l: 0, h: 0.2 }, "body"], "front_bumper"],
    [[{ f: -0.95, l: 0.3, h: 0.3 }, "body"], "rear_bumper"],
    [[{ f: 0.6, l: 0.1, h: 0.5 }, "body"], "hood"],
    [[{ f: 0, l: 0, h: 1 }, "body"], "roof"],
    [[{ f: -0.6, l: -0.2, h: 0.6 }, "body"], "trunk"],
    [[{ f: 0.6, l: 0.95, h: 0.4 }, "body"], "front_left_fender"],
    [[{ f: 0.1, l: 0.95, h: 0.4 }, "body"], "front_left_door"],
    [[{ f: -0.2, l: -0.95, h: 0.4 }, "body"], "rear_right_door"],
    [[{ f: -0.6, l: -0.95, h: 0.4 }, "body"], "rear_right_quarter"],
  ];
  for (const [args, expected] of cases) {
    const id = classifyPoint(...args);
    assert.equal(id, expected, JSON.stringify(args));
    assert.ok((COMPONENT_IDS as readonly string[]).includes(id));
  }
});
