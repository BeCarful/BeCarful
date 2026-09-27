// Example Florida configurations built from Florida statutes, FLHSMV and each insurer's own pages (see sources); not quotes.
import type { PolicyExtraction } from "@/schemas/policy";

export type FloridaPlan = {
  id: string;
  providerId: string;
  name: string;
  summary: string;
  coverage: Pick<PolicyExtraction, "policyType" | "collision" | "comprehensive" | "liability" | "deductibles" | "rentalReimbursement" | "roadsideAssistance" | "otherCoverage" | "exclusions">;
  sources: { title: string; url: string }[];
};

type Coverage = FloridaPlan["coverage"];
type Source = FloridaPlan["sources"][number];

export const FLORIDA_PLANS_RETRIEVED = "2026-09-26";

const MINIMUM_LAW: Source[] = [
  { title: "FLHSMV: Florida insurance requirements", url: "https://www.flhsmv.gov/insurance/" },
  { title: "Fla. Stat. § 627.736 (required PIP benefits)", url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.736.html" },
  { title: "Fla. Stat. § 324.022 (property damage liability)", url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0324/Sections/0324.022.html" },
  { title: "Fla. Stat. § 627.739 (PIP deductibles)", url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.739.html" },
];
const LIABILITY_LAW: Source[] = [
  ...MINIMUM_LAW,
  { title: "Fla. Stat. § 324.021 (financial responsibility limits)", url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0324/Sections/0324.021.html" },
  { title: "Fla. Stat. § 627.727 (uninsured motorist)", url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.727.html" },
];
const FULL_LAW: Source[] = [...LIABILITY_LAW, { title: "Fla. Stat. § 627.7288 (no windshield deductible)", url: "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.7288.html" }];

const PIP = "Personal injury protection (PIP): $10,000 per person, plus $5,000 death benefit";
const PDL = "Property damage liability: $10,000 per crash";
const UM = "Uninsured/underinsured motorist: same limits as bodily injury unless you rejected it or chose lower limits in writing";
const PIP_DEDUCTIBLE = "PIP: optional $250, $500 or $1,000 deductible";
const PIP_LIMITS = [
  "PIP medical benefits only apply if you get initial care within 14 days of the crash",
  "PIP pays 80% of medical bills and 60% of lost income",
  "PIP medical benefits are capped at $2,500 unless a doctor finds an emergency medical condition",
];
const NO_OWN_CAR = "Doesn't pay to repair or replace your own car";

const MINIMUM: Coverage = {
  policyType: "Florida minimum (PIP + property damage liability)",
  collision: null,
  comprehensive: null,
  liability: "Property damage only: $10,000 per crash (no bodily injury liability)",
  deductibles: PIP_DEDUCTIBLE,
  rentalReimbursement: null,
  roadsideAssistance: null,
  otherCoverage: [PIP, PDL],
  exclusions: [...PIP_LIMITS, NO_OWN_CAR, "No bodily injury liability, so injuries you cause to others aren't covered"],
};

const LIABILITY: Coverage = {
  ...MINIMUM,
  policyType: "Liability + PIP",
  liability: "Bodily injury from $10,000 per person / $20,000 per crash and property damage from $10,000 per crash (Florida minimums; you may have chosen higher)",
  otherCoverage: [PIP, PDL, UM],
  exclusions: [...PIP_LIMITS, NO_OWN_CAR],
};

const FULL: Coverage = {
  ...LIABILITY,
  policyType: "Full coverage (liability + PIP + collision + comprehensive)",
  collision: "Included (you choose the deductible)",
  comprehensive: "Included (you choose the deductible; $0 for windshield damage)",
  deductibles: `${PIP_DEDUCTIBLE}; collision and comprehensive: you choose (no comprehensive deductible for windshield damage)`,
  exclusions: PIP_LIMITS,
};

const EXTRAS_TYPE = "Full coverage + rental & roadside";
const MINIMUM_SUMMARY = "Only what Florida law requires: $10,000 PIP for your own injuries and $10,000 for property you damage.";
const LIABILITY_SUMMARY = "Florida minimums plus bodily injury liability for injuries you cause; your own car isn't covered.";
const FULL_SUMMARY = "Liability and PIP plus collision and comprehensive to repair or replace your own car.";

const SF: Source[] = [
  { title: "State Farm Florida outline of coverage (153-7586 FL)", url: "https://www.statefarm.com/content/dam/sf-library/en-us/pca-endorsement/auto/153-7586.pdf" },
  { title: "State Farm Florida car policy booklet (9810C)", url: "https://www.statefarm.com/content/dam/sf-library/en-us/pca-endorsement/auto/9810C.pdf" },
  { title: "State Farm car insurance coverage options", url: "https://www.statefarm.com/insurance/auto/coverage-options" },
];
const SF_FULL: Coverage = {
  ...FULL,
  collision: "Included (you choose the deductible; waived for windshield glass repair)",
  comprehensive: "Included (you choose the deductible; $0 for windshield damage; $25/day up to $750 for transportation if your car is stolen)",
  exclusions: [
    ...PIP_LIMITS,
    "Car damage coverages exclude wear and tear, freezing and mechanical breakdown",
    "No car damage coverage while the driver is logged on to a rideshare app",
  ],
};

const GEICO: Source[] = [
  { title: "GEICO Florida car insurance", url: "https://www.geico.com/auto-insurance/states/fl/" },
  { title: "GEICO \"full coverage\" car insurance in Florida", url: "https://www.geico.com/auto-insurance/states/fl/full-coverage/" },
];
const PROGRESSIVE: Source[] = [
  { title: "Progressive: Florida car insurance", url: "https://www.progressive.com/answers/florida-car-insurance/" },
  { title: "Progressive car insurance coverages", url: "https://www.progressive.com/auto/insurance-coverages/" },
];
const ALLSTATE: Source[] = [
  { title: "Allstate: car insurance in Florida", url: "https://www.allstate.com/auto-insurance/florida-car-insurance-coverages" },
];
const LIBERTY: Source[] = [
  { title: "Liberty Mutual Florida car insurance", url: "https://www.libertymutual.com/vehicle/auto-insurance/state/florida" },
  { title: "Liberty Mutual car insurance coverages", url: "https://www.libertymutual.com/vehicle/auto-insurance/coverage" },
];
const USAA: Source[] = [
  { title: "USAA Florida car insurance", url: "https://www.usaa.com/insurance/vehicles/auto/states/florida/" },
  { title: "USAA auto insurance", url: "https://www.usaa.com/insurance/vehicles/auto/" },
  { title: "USAA uninsured and underinsured motorist coverage", url: "https://www.usaa.com/insurance/vehicles/auto/coverage/uninsured-underinsured/" },
];

export const FLORIDA_PLANS: FloridaPlan[] = [
  { id: "state-farm-fl-minimum", providerId: "state-farm", name: "Florida minimum", summary: MINIMUM_SUMMARY, coverage: MINIMUM, sources: [SF[0], ...MINIMUM_LAW] },
  { id: "state-farm-fl-liability", providerId: "state-farm", name: "Liability + PIP", summary: LIABILITY_SUMMARY, coverage: LIABILITY, sources: [...SF, ...LIABILITY_LAW] },
  { id: "state-farm-fl-full", providerId: "state-farm", name: "Full coverage", summary: FULL_SUMMARY, coverage: SF_FULL, sources: [...SF, ...FULL_LAW] },
  {
    id: "state-farm-fl-full-extras",
    providerId: "state-farm",
    name: "Full coverage + extras",
    summary: "Full coverage plus State Farm Emergency Road Service and Car Rental and Travel Expenses.",
    coverage: {
      ...SF_FULL,
      policyType: EXTRAS_TYPE,
      rentalReimbursement: "Car Rental and Travel Expenses: $50/day up to $1,500, $75/day up to $2,250 or $100/day up to $3,000; up to $500 travel expenses and $500 rental-car deductible",
      roadsideAssistance: "Emergency Road Service: towing, up to 1 hour of labor at the breakdown, fuel/battery/tire delivery, lockout help",
      exclusions: [...SF_FULL.exclusions, "Emergency Road Service doesn't pay for the gas, oil, battery or tire itself"],
    },
    sources: [...SF, ...FULL_LAW],
  },

  { id: "geico-fl-minimum", providerId: "geico", name: "Florida minimum", summary: MINIMUM_SUMMARY, coverage: MINIMUM, sources: [GEICO[0], ...MINIMUM_LAW] },
  { id: "geico-fl-liability", providerId: "geico", name: "Liability + PIP", summary: LIABILITY_SUMMARY, coverage: LIABILITY, sources: [GEICO[0], ...LIABILITY_LAW] },
  { id: "geico-fl-full", providerId: "geico", name: "Full coverage", summary: FULL_SUMMARY, coverage: FULL, sources: [...GEICO, ...FULL_LAW] },
  {
    id: "geico-fl-full-extras",
    providerId: "geico",
    name: "Full coverage + extras",
    summary: "Full coverage plus GEICO rental reimbursement and Emergency Roadside Service.",
    coverage: {
      ...FULL,
      policyType: EXTRAS_TYPE,
      rentalReimbursement: "Rental reimbursement after an accident (limit set on your policy)",
      roadsideAssistance: "Emergency Roadside Service: flat tires, battery jumps, fuel delivery, lockouts",
    },
    sources: [...GEICO, ...FULL_LAW],
  },

  { id: "progressive-fl-minimum", providerId: "progressive", name: "Florida minimum", summary: MINIMUM_SUMMARY, coverage: MINIMUM, sources: [PROGRESSIVE[0], ...MINIMUM_LAW] },
  { id: "progressive-fl-liability", providerId: "progressive", name: "Liability + PIP", summary: LIABILITY_SUMMARY, coverage: LIABILITY, sources: [PROGRESSIVE[0], ...LIABILITY_LAW] },
  { id: "progressive-fl-full", providerId: "progressive", name: "Full coverage", summary: FULL_SUMMARY, coverage: FULL, sources: [...PROGRESSIVE, ...FULL_LAW] },
  {
    id: "progressive-fl-full-extras",
    providerId: "progressive",
    name: "Full coverage + extras",
    summary: "Full coverage plus Progressive rental car reimbursement and Roadside Assistance.",
    coverage: {
      ...FULL,
      policyType: EXTRAS_TYPE,
      rentalReimbursement: "Rental car reimbursement after a covered accident, up to your policy's limits",
      roadsideAssistance: "Roadside Assistance: towing, lockouts, flat tire changes, fuel/fluid delivery",
    },
    sources: [...PROGRESSIVE, ...FULL_LAW],
  },

  { id: "allstate-fl-minimum", providerId: "allstate", name: "Florida minimum", summary: MINIMUM_SUMMARY, coverage: MINIMUM, sources: [...ALLSTATE, ...MINIMUM_LAW] },
  { id: "allstate-fl-liability", providerId: "allstate", name: "Liability + PIP", summary: LIABILITY_SUMMARY, coverage: LIABILITY, sources: [...ALLSTATE, ...LIABILITY_LAW] },
  { id: "allstate-fl-full", providerId: "allstate", name: "Full coverage", summary: FULL_SUMMARY, coverage: FULL, sources: [...ALLSTATE, ...FULL_LAW] },
  {
    id: "allstate-fl-full-extras",
    providerId: "allstate",
    name: "Full coverage + extras",
    summary: "Full coverage plus Allstate rental car reimbursement and roadside assistance.",
    coverage: {
      ...FULL,
      policyType: EXTRAS_TYPE,
      rentalReimbursement: "Rental car reimbursement (limit set on your policy)",
      roadsideAssistance: "Roadside assistance: towing, flat tires, jump-starts, lockouts",
    },
    sources: [...ALLSTATE, ...FULL_LAW],
  },

  { id: "liberty-mutual-fl-minimum", providerId: "liberty-mutual", name: "Florida minimum", summary: MINIMUM_SUMMARY, coverage: MINIMUM, sources: [LIBERTY[0], ...MINIMUM_LAW] },
  { id: "liberty-mutual-fl-liability", providerId: "liberty-mutual", name: "Liability + PIP", summary: LIABILITY_SUMMARY, coverage: LIABILITY, sources: [LIBERTY[0], ...LIABILITY_LAW] },
  { id: "liberty-mutual-fl-full", providerId: "liberty-mutual", name: "Full coverage", summary: FULL_SUMMARY, coverage: FULL, sources: [...LIBERTY, ...FULL_LAW] },
  {
    id: "liberty-mutual-fl-full-extras",
    providerId: "liberty-mutual",
    name: "Full coverage + extras",
    summary: "Full coverage plus Liberty Mutual rental car reimbursement and Towing and Labor.",
    coverage: {
      ...FULL,
      policyType: EXTRAS_TYPE,
      rentalReimbursement: "Rental car reimbursement (limit set on your policy)",
      roadsideAssistance: "Towing and Labor with 24-hour Roadside Assistance",
    },
    sources: [...LIBERTY, ...FULL_LAW],
  },

  { id: "usaa-fl-minimum", providerId: "usaa", name: "Florida minimum", summary: MINIMUM_SUMMARY, coverage: MINIMUM, sources: [USAA[0], ...MINIMUM_LAW] },
  { id: "usaa-fl-liability", providerId: "usaa", name: "Liability + PIP", summary: LIABILITY_SUMMARY, coverage: LIABILITY, sources: [...USAA, ...LIABILITY_LAW] },
  { id: "usaa-fl-full", providerId: "usaa", name: "Full coverage", summary: FULL_SUMMARY, coverage: FULL, sources: [...USAA, ...FULL_LAW] },
  {
    id: "usaa-fl-full-extras",
    providerId: "usaa",
    name: "Full coverage + extras",
    summary: "Full coverage plus USAA rental reimbursement and Towing and Labor with Roadside Assistance.",
    coverage: {
      ...FULL,
      policyType: EXTRAS_TYPE,
      rentalReimbursement: "Rental reimbursement while your car is repaired after a covered loss (limit set on your policy)",
      roadsideAssistance: "Towing and Labor with USAA Roadside Assistance: breakdowns, out of gas, flat tires",
      exclusions: [...FULL.exclusions, "Roadside Assistance doesn't cover the cost of repair parts"],
    },
    sources: [...USAA, ...FULL_LAW],
  },
];

export const getFloridaPlan = (id: string) => FLORIDA_PLANS.find((p) => p.id === id);
