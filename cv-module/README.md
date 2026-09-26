# BeCarful CV Module

Evaluation-only backend pipeline for multi-view visible vehicle-damage assessment. It is not an
insurance estimate, safety determination, liability decision, fraud decision, or substitute for a
professional inspection.

Everything needed by this module lives in this directory. Do not place generated files, deployment
configuration, datasets, models, or module documentation in the repository root.

## What is implemented

- FastAPI public API with authentication disabled for the current evaluation phase and an opt-in
  Firebase mode reserved for a later milestone.
- Write-once signed Cloud Storage uploads for JPEG, PNG, WebP, HEIC, and HEIF images.
- Explicit claim submission and deterministic analysis-run IDs.
- Authenticated Cloud Tasks dispatch to a private Cloud Run worker.
- Firestore persistence with worker leases and idempotent terminal-run handling.
- Safe decoding, EXIF orientation, capture-time extraction, JPEG normalization, quality metrics, and
  perceptual duplicate detection.
- Gemini intake and damage calls with versioned prompts and Pydantic-derived response schemas.
- Required front/rear/left/right coverage, stable part taxonomy, normalized evidence boxes,
  deterministic finding aggregation, and mandatory review while confidence is uncalibrated.
- Claim and account-data deletion across Storage and Firestore.
- Terraform for the Google Cloud services and IAM boundary.
- Persistent local runtime using filesystem objects, a JSON repository, direct PUT uploads, and an
  in-process task runner.
- Cloud-free unit and integration tests using injected in-memory adapters.

## Layout

```text
src/cv_module/       API, worker, domain, services, and adapters
tests/               Cloud-free contract and pipeline tests
infra/terraform/     Google Cloud infrastructure
datasets/            Metadata registry only; downloads are ignored
docs/                Architecture, operations, and evaluation guidance
scripts/             Commands constrained to this directory
```

## Local verification

Python 3.12 is required. Docker and Terraform are not needed for the local runtime:

```powershell
Set-Location C:\Users\HGT\Documents\Github\BeCarful\cv-module
.\scripts\test.ps1
```

To recreate the existing virtual environment with a system Python 3.12 installation:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m pytest --cov=cv_module
```

Run the local API directly from the virtual environment, without Docker:

```powershell
.\scripts\dev.ps1
```

Local and staging configurations default to `AUTH_MODE=disabled`, so API requests do not need an
`Authorization` header and all claims belong to one anonymous evaluation owner. This mode is not a
security boundary: do not expose it to untrusted users. Account-wide deletion is disabled, while
individual claim deletion remains available. Production startup refuses disabled authentication.

Set `AUTH_MODE=development` locally to exercise `Authorization: Bearer dev:<uid>` owner isolation.
The default `BACKEND_MODE=local` stores state and images beneath the ignored `var/local` directory,
serves real write-once upload URLs, and runs queued analysis in the API process. The default
`INFERENCE_MODE=stub` exercises the complete workflow without making a Gemini call and never reports
damage. Set `INFERENCE_MODE=gemini` only after configuring Google Application Default Credentials;
local normalized images are then sent inline to Gemini. The in-memory backend remains available for
tests. Staging and production refuse local and memory backends.

## Public endpoints

- `POST /v1/claims`
- `POST /v1/claims/{claim_id}/images:prepare-upload`
- `POST /v1/claims/{claim_id}:submit`
- `GET /v1/claims/{claim_id}`
- `GET /v1/claims/{claim_id}/assessment`
- `DELETE /v1/claims/{claim_id}`
- `DELETE /v1/users/me/data`

No bearer token is required while `AUTH_MODE=disabled`. The prepare-upload response identifies the
exact headers the client must include in its PUT request. A claim may contain at most 12 images.

## Google Cloud deployment

1. Create or select the Google Cloud project and choose a globally unique Storage bucket name.
2. Copy `infra/terraform/terraform.tfvars.example` to the ignored `terraform.tfvars`. Bootstrap the
   required APIs and Artifact Registry repository with targeted Terraform applies before referencing
   the application image.
3. Build this directory and push one digest-pinned image to that repository; set `container_image` to
   the resulting digest URL.
4. Apply the full Terraform configuration from `infra/terraform`. If the project already has a
   Firestore database, set `create_firestore_database = false`.
5. Enter the current Gemini token prices only after verifying them; empty price settings deliberately
   produce a null cost estimate instead of a stale estimate.
6. Verify signed upload PUTs, task dispatch, and a deletion canary in staging.

The staging API is publicly invokable and unauthenticated while `AUTH_MODE=disabled`; use it only in a
controlled evaluation environment. The worker is not public; only its Cloud Tasks service account
receives `roles/run.invoker`. Before a production rollout, implement Firebase and set
`AUTH_MODE=firebase`.

## Processing behavior

The state flow is `draft → queued → preprocessing → assessing`, followed by `completed`,
`needs_more_photos`, `needs_human_review`, or `failed`. Until a held-out calibration set is approved,
all otherwise successful assessments end in `needs_human_review` with a null confidence score.

Cloud Tasks can deliver more than once. The worker acquires a Firestore lease and treats terminal runs
as idempotent successes. A busy lease returns `503` so a retry cannot acknowledge work that may still
be running.

See [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md), and
[evaluation](docs/EVALUATION.md) for the detailed contracts and gates.
