export const COMPONENT_IDS = [
  "front_bumper",
  "rear_bumper",
  "hood",
  "trunk",
  "roof",
  "windshield",
  "rear_window",
  "front_left_fender",
  "front_right_fender",
  "rear_left_quarter",
  "rear_right_quarter",
  "front_left_door",
  "front_right_door",
  "rear_left_door",
  "rear_right_door",
  "front_left_wheel",
  "front_right_wheel",
  "rear_left_wheel",
  "rear_right_wheel",
  "left_headlight",
  "right_headlight",
  "left_taillight",
  "right_taillight",
] as const;
export type ComponentId = (typeof COMPONENT_IDS)[number];

export const SEVERITIES = ["minor", "moderate", "severe"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const DAMAGE_TYPES = [
  "dent",
  "scratch",
  "crack",
  "broken",
  "shattered",
  "missing",
  "deformed",
  "paint_damage",
  "flood_damage",
  "fire_damage",
  "other",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const VEHICLE_VIEWS = ["front", "rear", "left", "right", "front_left", "front_right", "rear_left", "rear_right", "unknown"] as const;
export type VehicleView = (typeof VEHICLE_VIEWS)[number];

export const PHOTO_ISSUES = ["unreadable", "low_resolution", "too_dark", "too_bright", "possibly_blurry"] as const;
export type PhotoIssue = (typeof PHOTO_ISSUES)[number];

export type Box = { xMin: number; yMin: number; xMax: number; yMax: number };

export const INCIDENT_TYPES = ["collision", "flood", "theft", "vandalism", "hail", "fire", "weather", "other"] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const INCIDENT_STATUSES = ["documenting", "analyzing", "action_required", "ready_to_file", "filed", "closed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const POLICY_STATUSES = ["processing", "processed", "failed"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const PHOTO_SOURCES = ["camera", "upload"] as const;
export type PhotoSource = (typeof PHOTO_SOURCES)[number];

export const ANALYSIS_STATUSES = ["pending", "analyzing", "done", "failed"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const TASK_CODES = [
  "UPLOAD_INSURANCE",
  "PROCESS_POLICY",
  "ADD_PHOTOS",
  "ADD_DAMAGE_PHOTOS",
  "COMPLETE_INCIDENT_INFO",
  "FILE_CLAIM",
] as const;
export type TaskCode = (typeof TASK_CODES)[number];

export type TodoItem = {
  code: TaskCode;
  title: string;
  detail?: string;
  done: boolean;
  href?: string;
};

export type DamagedComponent = {
  component: ComponentId;
  damageTypes: DamageType[];
  severity: Severity;
  confidence: number;
  description: string;
  box?: Box;
};

/** One entry per damaged component across every assessment of the current incident. */
export type AggregatedDamage = DamagedComponent & { photoIds: string[] };

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const NOT_FOUND_IN_POLICY = "Not found in the uploaded policy";

export function componentLabel(id: ComponentId): string {
  const s = id.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Coverage checklist: the risks a policy can protect against. Uncovered ones show up as Tuxemon "attackers".
export const PERILS = [
  "collision",
  "liability",
  "injury",
  "uninsured_driver",
  "theft",
  "fire",
  "flood",
  "storm",
  "vandalism",
  "animal",
  "glass",
  "roadside",
] as const;
export type Peril = (typeof PERILS)[number];

export const PERIL_LABELS: Record<Peril, string> = {
  collision: "Crashes with a car or object",
  liability: "Damage or injuries you cause others",
  injury: "Your own medical bills (PIP)",
  uninsured_driver: "Uninsured or hit-and-run drivers",
  theft: "Theft",
  fire: "Fire",
  flood: "Flood",
  storm: "Hail, wind and hurricanes",
  vandalism: "Vandalism",
  animal: "Hitting an animal",
  glass: "Windshield and glass",
  roadside: "Breakdowns and towing",
};

export const INCIDENT_PERIL: Record<IncidentType, Peril | null> = {
  collision: "collision",
  flood: "flood",
  theft: "theft",
  vandalism: "vandalism",
  hail: "storm",
  fire: "fire",
  weather: "storm",
  other: null,
};

export const COVERAGE_STATUSES = ["covered", "not_covered", "unknown"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const CHAT_ACTION_STATUSES = ["pending", "running", "done", "failed", "cancelled"] as const;
export type ChatActionStatus = (typeof CHAT_ACTION_STATUSES)[number];

export const JURISDICTIONS = ["florida", "federal"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const POLICY_PRODUCTS = ["personal_car", "classic_plus"] as const;
export type PolicyProduct = (typeof POLICY_PRODUCTS)[number];
