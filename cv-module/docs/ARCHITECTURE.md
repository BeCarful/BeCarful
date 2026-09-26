# Architecture

The current local runtime substitutes private filesystem objects, an atomic JSON repository, and an
in-process task runner for Cloud Storage, Firestore, and Cloud Tasks. It retains the same claim,
image, run, and assessment contracts so the GCP adapters can be enabled later.

```text
Evaluation client (authentication currently disabled)
  │
  ├─ create claim / request upload authorization
  │        │
  │        └─ private Cloud Storage bucket
  │
  └─ submit claim
           │
           ├─ freeze object generations in Firestore
           └─ named Cloud Task
                    │ OIDC
                    ▼
             private Cloud Run worker
                    │
                    ├─ validate and normalize images
                    ├─ Gemini intake and coverage gate
                    ├─ Gemini visible-damage assessment
                    ├─ semantic contract validation
                    └─ Firestore result + private run artifacts
```

## Trust boundaries

- Local and staging evaluation currently map requests to one anonymous owner. This provides no access
  control and must not be used for an untrusted or production deployment.
- The authentication adapter remains isolated so Firebase verification can be enabled later without
  changing claim-service ownership checks.
- Local upload tickets are short-lived, unguessable, content-type-bound, and write-once. Cloud signed
  PUT URLs additionally require generation match zero.
- Cloud Run IAM authenticates the worker invocation. Cloud Tasks headers are operational metadata,
  not identity.
- Storage objects are private and use uniform bucket-level access.
- The model never receives instructions to identify plates, people, GPS, price, liability, fraud,
  drivability, or total loss.
- Every model response passes Pydantic validation plus checks that evidence references only supplied,
  usable image IDs.

## Persistence

Firestore uses `claims/{claim_id}` with `images`, `runs`, and `assessments` subcollections. Large raw
responses and normalized images use `claims/{claim_id}/runs/{run_id}/...` in Cloud Storage. User
deletion removes the entire Storage prefix and known Firestore subcollections before writing a
non-identifying SHA-256 tombstone.

In local mode, `var/local/repository.json` stores compact state and `var/local/objects` mirrors the
object-name hierarchy. Writes use temporary files followed by atomic replacement. This adapter is
intended for one process and is not a replacement for Firestore's distributed transactions.

## Idempotency

The run ID hashes the claim ID and frozen image generations. The task name hashes the claim/run pair.
The worker uses a renewable-by-retry Firestore lease and immediately acknowledges terminal runs.
Finding IDs hash the canonical part and damage type so aggregation is deterministic.
