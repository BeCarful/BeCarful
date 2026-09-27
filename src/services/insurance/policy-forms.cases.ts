import type { PolicyProduct } from "@/types";
import type { PolicyFormChunk } from "./policy-forms";

type Expect = { form?: RegExp; section?: RegExp; text?: RegExp };
export type RetrievalCase = { q: string; product: PolicyProduct; expect: Expect };

const car = (q: string, expect: Expect): RetrievalCase => ({ q, product: "personal_car", expect });
const classic = (q: string, expect: Expect): RetrievalCase => ({ q, product: "classic_plus", expect });

export const RETRIEVAL_CASES: RetrievalCase[] = [
  car("Is flood or water damage to my car covered?", { text: /water, flood/i }),
  car("Will you pay for a rental car while my car is being repaired after an accident?", { section: /Car Rental/, text: /not drivable or is being\s+repaired/i }),
  car("What do I have to do right after an accident?", { section: /^INSURED’S DUTIES/ }),
  car("Do I pay a deductible to replace a cracked windshield?", { text: /windshield/i }),
  car("Am I covered while I'm driving for Uber or Lyft?", { text: /TRANSPORTATION NETWORK/ }),
  car("I just bought another car. Is it covered right away?", { text: /Newly Acquired Car means|Newly Owned or Newly Leased Car/i }),
  car("Who counts as a resident relative on my policy?", { text: /Resident Relative means/ }),
  car("Will my policy pay the medical bills of my passengers?", { section: /^(NO-FAULT|MEDICAL PAYMENTS) COVERAGE › Insuring Agreement/ }),
  car("What happens if the driver who hit me has no insurance?", { section: /^UNINSURED MOTOR VEHICLE COVERAGE/ }),
  car("How much does personal injury protection pay for medical expenses?", { section: /^NO-FAULT COVERAGE/, text: /\$10,000/ }),
  car("Is damage from racing or a speed contest excluded?", { section: /Exclusions/, text: /RACING/ }),
  car("Can State Farm cancel my car insurance?", { text: /cancel/i }),
  car("Is my car covered if someone steals it?", { section: /Comprehensive Coverage|Additional Definitions/, text: /theft/i }),
  car("Does my policy pay for towing when my car breaks down?", { section: /Emergency Road Service/, text: /towing/i }),
  car("Is mold damage covered?", { text: /fungi/i }),
  car("How do you decide what my car is worth if it is totaled?", { section: /Limit and Loss Settlement/, text: /actual cash value/i }),
  car("Will they fix my car with aftermarket parts instead of original parts?", { text: /non-original equipment/i }),
  car("Who defends me if I get sued after a crash?", { section: /Insuring Agreement/, text: /defend an insured/i }),
  car("My dog got hurt in the crash. Does insurance pay the vet?", { section: /Pet Injury/ }),
  car("Am I covered if I drive my car into Mexico?", { section: /Mexico/ }),
  car("Do I have to answer questions under oath?", { section: /Questioning Under Oath/ }),
  car("What does the policy pay if someone dies in the crash?", { text: /death/i, section: /DEATH|Death Benefits/ }),
  car("I disagree with the repair estimate. How is it settled?", { text: /disagreement as to the cost of repair/i }),
  car("Is my own car insured if my friend borrows it?", { section: /Additional Definition › Insured|Insuring Agreement/ }),
  car("Does the policy cover a car I rent on vacation?", { text: /Temporary Substitute Car means|Non-Owned Car means|rented/i }),
  classic("Is my collector car paid at its guaranteed value if it's totaled?", { form: /^SC 900$/, text: /Guaranteed Value/ }),
  classic("Are spare parts for my classic car covered?", { form: /^SC (900|501 FL)$/, text: /spare parts/i }),
  classic("Is my passenger covered on my collector motorcycle?", { form: /^SC 103 FL$/ }),
  classic("Is my car covered at a high performance driving school on a race track?", { form: /^SC 12[67] FL$/ }),
  classic("Is my classic car covered while it is being restored or built?", { form: /^SC 116 FL$/ }),
  classic("Does the policy cover automobilia and collectibles in my garage?", { form: /^SC 500 FL$/ }),
  classic("Can I drive my classic car to work every day?", { form: /^SC 900$/, text: /regular use vehicle|commut/i }),
];

export const matches = (c: RetrievalCase, chunk: PolicyFormChunk) =>
  (!c.expect.form || c.expect.form.test(chunk.form)) && (!c.expect.section || c.expect.section.test(chunk.section)) && (!c.expect.text || c.expect.text.test(chunk.text));
