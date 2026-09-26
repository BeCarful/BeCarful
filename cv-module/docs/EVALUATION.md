# Dataset and Evaluation Protocol

## Dataset discovery gate

Every candidate must be entered in `datasets/registry.yaml` before download. Approval requires a
verified source, version, annotation inventory, provenance review, checksum plan, written usage rights,
commercial restrictions, redistribution rules, and whether model weights derived from it may be used.
Files remain under ignored `datasets/downloads/`; they are never committed.

CarDD is damage-focused and permission-restricted, DSMLR is part-focused, and CrashCar101 is synthetic.
They are complementary rather than interchangeable. Do not merge their annotations into one detector
as though unannotated classes were background.

## First-party benchmark

Acquire at least 100 consented vehicle sets and 600–1,000 images. Include four to eight views per
vehicle, at least 20% no-damage controls, and variation in body style, color, lighting, weather, damage,
and camera quality. Label view, usability, part, damage type, visual severity, and evidence box.
Double-label 20% and adjudicate with an automotive repair professional.

Split by vehicle: 60% development, 20% calibration, and 20% locked test. Public or synthetic data may
support exploration, but only the claim-like held-out set controls release decisions.

## Release gates

- Schema and semantic validity: 100% after the permitted retry.
- View macro-F1: at least 0.90.
- Moderate/severe claim recall: at least 0.90.
- Part-plus-damage-type precision: at least 0.75.
- Severity weighted Cohen's kappa: at least 0.70.
- Confidence expected calibration error: at most 0.10.
- Human-review gate recall for materially wrong moderate/severe cases: at least 0.95.
- Duplicate delivery produces no duplicate records or effects.
- Test deletion removes all artifacts within 24 hours.

Until calibration meets its gate, public confidence remains `{score: null, band: "unvalidated",
calibration_version: null}` and every result requires review.

