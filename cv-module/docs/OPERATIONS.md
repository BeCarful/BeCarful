# Operations

## Required configuration

Production and staging require `BACKEND_MODE=gcp` and all variables shown in `.env.example`.
`GEMINI_MODEL`, `GIT_REVISION`, prompt version, and schema version are persisted on every result.
Set both configurable per-million-token price variables to report an estimated per-claim model cost;
leave both empty rather than publishing a stale or invented price.

The current evaluation deployment uses `AUTH_MODE=disabled`. All requests map to one anonymous owner,
bearer tokens are ignored, and account-wide deletion is blocked. Keep this deployment restricted to
controlled testing. `APP_ENV=production` refuses to start until authentication is enabled. Firebase
setup and `AUTH_MODE=firebase` are deferred to a later milestone.

## Local runtime

`BACKEND_MODE=local` writes image objects and durable JSON state beneath `LOCAL_DATA_DIR` (default
`var/local`). Upload preparation returns a time-limited URL handled by the same FastAPI process, and
submission schedules analysis in that process. This mode is for one local process only and does not
provide distributed locking or crash-resilient task delivery.

`INFERENCE_MODE=stub` is the safe default and produces no damage findings. To exercise Gemini while
keeping storage local, authenticate Google Application Default Credentials, retain the configured
`GCP_PROJECT`, and set `INFERENCE_MODE=gemini`. Normalized images are supplied inline to the model.

## Monitoring

Create log-based metrics and alerts for:

- Cloud Tasks queue age and exhausted attempts.
- Run failures grouped by `error_code`.
- Model latency, input/output tokens, and schema retries.
- Claims remaining in a processing state longer than the 20-minute worker lease.
- Deletion failures or deletion requests older than 24 hours.
- Daily assessment count and estimated model cost.

Logs must contain claim and run IDs but never image bytes, signed URLs, bearer tokens, raw EXIF, model
responses, or owner identifiers.

## Failure handling

- Transient infrastructure failures return `503` and are retried by Cloud Tasks up to three attempts.
- Model contract failures receive one immediate model retry, then terminate with
  `model_contract_failure`.
- Corrupt and unsupported individual images become unusable evidence; the coverage gate requests
  replacements rather than crashing the claim.
- A busy lease returns `503`. It must never return success because that would acknowledge potentially
  unfinished work.
- Terminal run delivery is a successful no-op.

## Deletion

Claim deletion is synchronous for this bounded MVP and removes all object generations and Firestore
children. The account-data endpoint performs the same operation for each owned claim. Alert if a
request cannot complete; the operational deadline is 24 hours.

## Manual setup outside this directory

The repository-boundary rule prevents adding repository-root CI configuration. Configure the external
CI system manually to use `cv-module` as its checkout working directory and run the Docker test target.
Firebase Authentication provider activation remains a future console or organization-level setup
step; it is not needed for the current evaluation deployment.
