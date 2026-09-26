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
  assert.equal(partKind(["Wheel_-_Front_Left_|_Tire_and_Rim"], "Wheel1A_Material1"), "wheel");
  assert.equal(partKind(["Body_Shell_and_Trim_|_Black_Trim", "Body_Shell_and_Trim"], "Base_Material1"), "body");
  assert.equal(partKind(["Left_Door_|_Interior_Highlights", "Left_Door"], "int_color_2"), "body");
  assert.equal(partKind(["Headlight_-_Left_|_Clear_Lens", "Headlight_-_Left"], "light_glass"), "glass");
  assert.equal(partKind(["Taillight_-_Right_|_Red_Lens"], "red_glass"), "taillight");
  assert.equal(partKind(["skel_mesh_043_001_vehicle_detail2_002_0", "SUSP_LF"], "vehicle_detail2_002"), "body");
  assert.equal(partKind(["_mesh_001_001_vehicle_tire_002_0", "WHEEL_LF"], "vehicle_tire"), "wheel");
  assert.equal(partKind(["lowbeam_vehicle_lightsemissive_001_0", "lowbeam"], "vehicle_lightsemissive_001"), "light");
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
