# BeCarful — Agent Instructions

Shared instructions for every coding agent working on this repo (Claude Code, ChatGPT/Codex, Grok Build, Gemini CLI, Cursor, Copilot, etc.).
`CLAUDE.md` and `GEMINI.md` only import this file. **Edit this file, not those.**
Using a chat UI without repo access (ChatGPT, Grok, Gemini web)? Attach or paste this file at the start of the conversation.

## Keep this file current (all agents)

This file is the team's shared memory. Everyone uses a different agent, so if it's not written here, the next agent won't know it.

**When your change adds, changes or removes a feature, update this file in the same commit/PR, if applicable:**

- New or changed feature, flow or screen → update its section (or add one)
- New command (dev, test, seed, lint…) → **Status and commands**
- New env var → **Environment variables** and `.env.example`
- New/changed model, field, status or task code → **Data model** / **Summary tab and to-do list**
- New/changed damage component ID → **Damage analysis and 3D mapping**
- Folder or architecture change → **Project structure**
- Library or approach chosen → **Decisions log**
- A build-order phase finished → mark it ✅ in **Build order**

Keep edits short and factual. Update or delete outdated lines instead of piling on. Don't rewrite other sections or change the core principles without the team agreeing.

## Working in this repo

- Before writing code, read what already exists and don't replace working code without a reason.
- Keep changes small and focused. Build the MVP end-to-end before adding complexity.
- Don't fill the code with comments. Only add short comments where a non-obvious decision needs explaining. Don't delete other people's comments.
- Use strict TypeScript. Keep UI, business logic, DB access, Cloud Storage, AI services, insurer metadata and 3D visualization separate.
- Never commit secrets. Add every new env var to `.env.example`.

## Status and commands

Next.js **16** — it has breaking changes vs. most models' training data (e.g. `middleware.ts` is now `proxy.ts`). Read the matching guide in `node_modules/next/dist/docs/` before using an unfamiliar Next API. `next dev` re-adds a short Next.js block to this file; keep it.

```
npm install
cp .env.example .env.local        # fill in values
docker run -d --name becarful-mongo -p 27017:27017 mongo:7   # or use Atlas
npm run seed        # demo@becarful.app / demo1234 (needs Mongo + Cloud Storage)
npm run dev         # http://localhost:3000
npm run build
npm run lint
npm run typecheck   # next typegen + tsc
npm test            # node:test via tsx (all **/*.test.ts: claim rules, damage merge, 3D zones, statute search, Jev guard, coverage rules, photo seal, image prep)
python3 scripts/tuxemon-idle.py   # regenerate public/tuxemon/*-idle.png (needs Pillow + numpy)
```

**Google Cloud** (Vertex AI for Gemini + Cloud Storage for files): `brew install --cask gcloud-cli`, then `gcloud auth application-default login --impersonate-service-account=<app service account>`. Signed upload/view URLs need a service account, so plain user ADC is not enough; you need Service Account Token Creator on it. The app service account needs Vertex AI User on the project and Storage Object Admin on the bucket. Vercel: Workload Identity Federation (Vercel OIDC, team issuer, pool/provider `vercel`, condition limited to project `be-carful`) impersonating the same service account, which also needs Token Creator on itself to sign URLs. Set `GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT_EMAIL` on Vercel.

**Bucket** (private: uniform access + public access prevention). CORS for browser uploads (signed POST policy): `gcloud storage buckets update gs://<bucket> --cors-file=cors.json` with
`[{"origin":["http://localhost:3000","https://<your-app>.vercel.app"],"method":["POST"],"responseHeader":["Content-Type"],"maxAgeSeconds":3600}]`.

### Decisions log

| Topic | Decision |
|---|---|
| Auth library | None: `jose` HS256 JWT in an httpOnly `session` cookie + `bcryptjs` (`lib/session.ts`, `lib/auth.ts`). `proxy.ts` only sends signed-out visitors to /login (cookie signature check); the auth layout sends signed-in users home via the DB-backed `getCurrentUser()`, so a signed cookie for a deleted user (e.g. after `npm run seed`) can't loop /login ↔ /. Every page/action still calls `requireUser()`/`requireVehicle()`. |
| Schema validation (Gemini output, API input) | Zod v4. Gemini uses `responseJsonSchema: z.toJSONSchema(schema)` and the same schema validates the reply (`services/ai/gemini.ts#generateJson`). |
| Mutations / data loading | Server Actions in `actions/*.ts` (return `ActionResult<T>`), server components read via services. No REST API. |
| Uploads | Browser → Cloud Storage signed POST policy (V4; the bucket enforces type + size, avoids Vercel's 4.5 MB body limit) → action registers the key after `isOwnedKey` + `headObject`. |
| Presigned URLs | Never stored; `getViewUrl(key)` on read (1 h). DB stores `s3Key` only (no `imageUrl`/`documentUrl` fields). |
| Insurer metadata | Static `services/insurance/providers.ts` (not a DB collection); `InsurancePolicy.providerId` is its string id. |
| To-dos | Computed on read by `computeTodos()` (pure, tested); no stored `TodoState`. Incident status synced by `refreshIncidentStatus()`. |
| Selected vehicle | `User.lastVehicleId`, changed by `selectVehicle()`; pages read it via `getVehicleContext()`. Switched from the "Vehicles" list (`VehicleSelector`): a sidebar section on `md`+, a bottom-nav tab that opens a native `popover` (`VehicleMenu`) on phones. |
| Car models | Static demo catalog `services/vehicles/car-models.ts` (`CAR_MODELS`: id, year/make/model, GLB url, axes, credit), not a DB collection. New vehicles must pick one (`Vehicle.modelId`, year/make/model copied from the catalog); vehicles without `modelId` show the first model. |
| Photo evidence | Camera only: `registerPhoto` rejects `source: "upload"`. On receipt the server stores `sha256` of the stored bytes and `seal` = HMAC-SHA256 (`AUTH_SECRET`) over vehicleId + sha256 + capturedAt + serverReceivedAt + location (`services/photos/seal.ts`, tested). It proves the bytes and metadata are unchanged since BeCarful received them, not that the device clock/GPS were true. No verify UI yet. |
| 3D car | R3F + drei GLB viewer (`Car3D.tsx`) behind `CarDamageView`, one GLB per catalog model. Parts come from named collections where the GLB has them (`namedPart`: "Left Door", "Headlight - Right", "Windshield"…), else position zones (`car-zones.ts`). The team's prototype (`3d_model_update/`) was folded in and removed: its collection highlight, "damage skips glass/interior" rule, transparency toggle (now **X-ray**) and per-part photo panel (now **+ Take a close-up**, camera only). 2D map (`CarDamageMap2D.tsx`) is the toggle + error fallback. |
| Design system | HouseToClaim-style tokens + Tailwind v4 `@utility` classes in `globals.css`; no component library. Fonts: Rubik (body) + Tektur (display) via `next/font`. |
| Agents | Google ADK for TypeScript (`@google/adk`): chat (`services/ai/chat-agent.ts`) and coverage checklist (`services/ai/coverage.ts`) are `LlmAgent`s with `FunctionTool`s. `runAgent()` (`services/ai/adk.ts`) rebuilds an in-memory ADK session per request from MongoDB history. `serverExternalPackages: ["@google/adk"]` (its optional peer deps break bundling). |
| Agent write guard | Jev (TypeSafe AI, `POST /v1/systemone`) classifies each non-read tool call in `beforeToolCallback`; code decides via `decide()` (`services/ai/guard.ts`, tested): reads run, `destructive` tools always wait for a Confirm tap, writes run alone only when Jev says benign + requested, confident "suspicious" is blocked, no key/outage → Confirm. A waiting write is stored as `ChatMessage.action` and run once by `resolveChatAction`. |
| Law RAG | In-memory BM25 over `data/florida` + `data/federal` (`services/law/statutes.ts`, tool `search_insurance_law`); files traced with `outputFileTracingIncludes`. Swap for embeddings if recall suffers. |
| Storage | Google Cloud Storage (`@google-cloud/storage`, `services/storage/gcs.ts`), replacing AWS S3. Same functions as before; the `s3Key` field name stays (it's the object key). |
| Gemini auth | Vertex AI only: `genaiAuth()` in `services/ai/gemini.ts` (`GOOGLE_CLOUD_PROJECT`, location `global`, model `GEMINI_MODEL` constant), Application Default Credentials locally; on Vercel `googleAuthOptions()` (`lib/gcp.ts`) swaps in a Vercel OIDC external-account credential for both Storage and GenAI. ADK reuses the shared `gemini()` client (`adkModel()` overrides `apiClient`) because its `Gemini` class takes no auth options. |
| Florida plans | Static, sourced `services/insurance/florida-plans.ts` (4 example configurations per insurer, retrieved 2026-09-26, no premiums). Picking one stores its text as the policy original, sets `planId` and skips Gemini extraction. |
| Photo preprocessing | Ported from the former Python `cv-module` (since removed) to `sharp` (`services/ai/image-prep.ts`): bytes must match the declared type, EXIF orientation applied (unrotated phone photos made Gemini swap left/right), low-res/dark/bright/blurry checks, ≤2048px JPEG to Gemini. View + part boxes come from the same Gemini call (`box_2d`, 0–1000). |
| Dev origin | `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` so the dev server also hydrates when opened via 127.0.0.1 (Next 16 blocks dev assets from other hostnames). |
| Tuxemon animation | Full-body sprites play a looping APNG (`public/tuxemon/<name>-idle.png`) generated by `scripts/tuxemon-idle.py` from the unmodified sheet's front frame: breathing/floating, blinks, per-creature motion. Tune a sprite's settings there and rerun; the adaptation is credited in `ATTRIBUTION.md` and the on-screen credit lines. |

---

## Product

**BeCarful** is a mobile-first, AI-powered car insurance companion. Users can:

- Register multiple vehicles, each with its own insurance policy
- Take or upload photos of damage (accident, flood, theft, vandalism, hail…)
- Get an AI damage assessment shown on an interactive low-poly 3D car
- Understand their policy in plain language
- Chat with an AI assistant about the selected vehicle
- Follow an auto-updating post-incident to-do list
- Reach the insurer's verified claim page with the info needed to file

It should feel like a cohesive consumer product, not a generic AI dashboard.

## Tech stack

Next.js (App Router) · React · TypeScript (strict) · Tailwind CSS · MongoDB + Mongoose · Google Cloud Storage · Gemini on Vertex AI (Google ADK) · React Three Fiber / Three.js · Vercel

## Core principles (non-negotiable)

1. **Everything is vehicle-centric.** Photos, insurance, chat, summary, to-dos and 3D damage state belong to the selected vehicle. Switching vehicles switches the whole app context.
2. **Mobile first.** Assume the user is standing next to a damaged car: big controls, minimal typing, fast camera, one-handed use, short AI answers, clear progress, no dense dashboards, no unnecessary modals.
3. **AI assists; app state controls workflow.** Critical workflow state is deterministic code, not LLM output.
4. **AI does not paint the car.** Gemini returns standard component IDs; Three.js maps IDs to known meshes.
5. **Cloud Storage stores files; MongoDB stores references + structured data.** Never put photos/PDFs in MongoDB.
6. **Cloud Storage is private.** Use presigned URLs or server-side access, never public URLs.
7. **Never hallucinate policy coverage.** Unknown → "Not found in the uploaded policy".
8. **Never blindly trust AI-generated insurer URLs.** Use maintained provider metadata; validate any AI-suggested URL against the insurer's official domain.
9. **Preserve original evidence.** Never overwrite original photos when making thumbnails or AI-processing copies.
10. **Summary is actionable.** It answers: What happened? What does my policy say? What am I missing? What should I do next?
11. **Tuxemon, not Pokémon.** No Pokémon characters, sprites, logos, fonts, maps or sounds. Use only license-compatible Tuxemon assets and keep their attribution/license notices.
12. **End-to-end first.** A working Photo → Cloud Storage → AI → component ID → 3D damage → Summary pipeline beats many half-done features.

---

## Project structure

Feature-oriented. All application code lives in `src/` (Next.js `src` folder; `@/*` → `./src/*`). File paths elsewhere in this doc are relative to `src/` unless they start with `public/`, `data/` or `scripts/`. Config files, `public/`, `data/`, `scripts/` and `.env*` stay at the repo root.

```
src/app/(auth)/        login, signup
src/app/(app)/         authed shell (layout: sky, road sidebar md+ with the Vehicles list, frosted header on phones, bottom nav + Vehicles popover on phones)
  page.tsx             Home        chat/  summary/  insurance/  profile/  vehicles/new/
src/actions/           server actions per feature: auth vehicles photos insurance chat incidents
src/components/        retro/ layout/ auth/ vehicle/ photos/ insurance/ chat/ summary/
src/lib/               env (zod, lazy), gcp (Vercel WIF credentials), db (cached mongoose), session (jose), auth, upload-client
src/models/            User Vehicle InsurancePolicy Incident DamagePhoto DamageAssessment ChatMessage
src/schemas/           zod: damage, policy, vehicle
src/services/          ai/ storage/ insurance/ vehicles/ claims/ law/
src/types/             shared constants + types (component IDs, statuses, task codes)
src/proxy.ts           optimistic auth redirect (Next 16 name for middleware)
scripts/seed.ts        demo data
public/                logo.png (brand logo; favicon is app/icon.png)  insurers/ (insurer logos)  scenery/ (grass, ground, pixel car SVGs)  tuxemon/ (sprite sheets, generated *-idle.png animations + ATTRIBUTION.md)  models/ (catalog GLBs lamborghini-sc18, peugeot-308 + ATTRIBUTION.md)
data/                  RAG source texts, one .txt per statute section (citation + source URL header): florida/ (2026 F.S.: ch. 627 Part XI, ch. 324, related sections), federal/ (2024 U.S. Code), state-farm/ (Florida OIR IRFS filing PDFs named <file log #>_<doc id>.pdf; policy wording text in 9810C-personal-car-policy.txt), source GLBs of the catalog cars (not served), peugeot-308/ (reference renders)
```

Key service files:

- `services/storage/gcs.ts` — all Cloud Storage access (signed POST uploads, `isOwnedKey`, signed view URLs, key generation)
- `services/ai/gemini.ts` — shared client + `generateJson()` (structured output validated by Zod)
- `services/ai/damage-analysis.ts`, `policy-analysis.ts`, `chat.ts` — one Gemini service per responsibility, never one giant prompt
- `services/ai/adk.ts` (ADK model + `runAgent`), `chat-agent.ts` (chat agent + guard), `agent-tools.ts` (every tool the agent can call, with `kind`: read / write / destructive), `coverage.ts` + `coverage-rules.ts` (coverage agent + deterministic evidence check), `guard.ts` (Jev + `decide`)
- `services/law/statutes.ts` — statute chunking + BM25 search over `data/`
- `services/claims/todos.ts` — deterministic to-do rules + incident status (pure, tested); `state.ts` loads a vehicle's claim state; `damage.ts` merges per-photo assessments
- `services/vehicles/context.ts` — `getVehicleContext()` for pages, `requireVehicle(vehicleId)` ownership gate for every vehicle-scoped action
- `services/vehicles/car-models.ts` — demo car catalog (`CAR_MODELS`, `carModel(id)`), shared by the form, actions, seed and `Car3D`
- `services/photos/seal.ts` — `sha256Hex` + `sealPhoto` (photo evidence HMAC)

## Environment variables

Server-side only. Keep `.env.example` current.

```
MONGODB_URI=
AUTH_SECRET=           # 32+ chars, signs the session cookie
GOOGLE_CLOUD_PROJECT=  # Vertex AI (Gemini) + Cloud Storage
GCS_BUCKET_NAME=
GCP_WORKLOAD_IDENTITY_PROVIDER=  # Vercel only: projects/<number>/locations/global/workloadIdentityPools/vercel/providers/vercel
GCP_SERVICE_ACCOUNT_EMAIL=       # Vercel only: the app service account
TYPESAFE_API_KEY=      # optional, Jev classifier; without it every agent write asks the user to confirm
```

---

## Data model

Mongoose models in `models/`: `User`, `Vehicle`, `InsurancePolicy`, `Incident`, `DamagePhoto`, `DamageAssessment`, `ChatMessage`. Insurer metadata is code (`services/insurance/providers.ts`), to-dos are computed (no `TodoState`), chat is one thread per vehicle (no `ChatSession`).

- Every vehicle-related query enforces **both `userId` ownership and `vehicleId`**. A vehicle's data must never leak into another vehicle's context (especially chat). Every child doc stores `userId` + `vehicleId`; actions get both from `requireVehicle(vehicleId)`.
- Use references, not duplicated data. Add indexes (e.g. `{ userId, vehicleId }`).
- Persist the user's last-selected vehicle (`User.lastVehicleId`).

**User:** email (unique), name, passwordHash (`select: false`), lastVehicleId.

**Vehicle:** userId, modelId (catalog id), year, make, model, trim?, color, vin?, licensePlate, state.

**DamagePhoto:**
```ts
{ userId, vehicleId, incidentId, s3Key, contentType, source: "camera" | "upload",
  capturedAt?, serverReceivedAt, latitude?, longitude?, locationAccuracy?, sha256?, seal?,
  analysisStatus: "pending" | "analyzing" | "done" | "failed", createdAt }
```

**DamageAssessment:** one per analyzed photo: `{ userId, vehicleId, incidentId, photoId, view, damagedComponents[] (optional 0–1 `box` each), summary, needsManualReview, photoIssues[], aiModel }`. `photoIssues` (`PHOTO_ISSUES`) come from code, not Gemini, and force `needsManualReview`. The car's damage state = `aggregateDamage()` over the open incident's assessments (worst severity per component).

**InsurancePolicy:**
```ts
{ userId, vehicleId, providerId, s3Key, fileName, uploadedAt,
  status: "processing" | "processed" | "failed", extractedData: PolicyExtraction | null, aiSummary, error?,
  coverageChecklist: { items: CoverageItem[], generatedAt } | null, planId? }
```
`CoverageItem = { peril, status: "covered" | "not_covered" | "unknown", detail, law: { citation, url } | null }`, one per `PERILS` (types/index.ts: collision, liability, injury, uninsured_driver, theft, fire, flood, storm, vandalism, animal, glass, roadside).
The newest `uploadedAt` per vehicle is the active policy (`getActivePolicy`); older ones are history.

**Insurance providers:** `PROVIDERS` in `services/insurance/providers.ts`: `{ id, name, shortName, color, logo?, claimsUrl, phone, officialDomains, supportedStates }`. `ProviderMark` shows `logo` if set, else a `shortName` tile. **State Farm** (`state-farm`) is the preferred/demo insurer (hackathon sponsor; its emblem is used with that permission). `isOfficialUrl()` validates any URL against `officialDomains`.

**Incident:** userId, vehicleId, insurancePolicyId, type (`INCIDENT_TYPES`), occurredAt, location, notes, status, filedAt. Photos/assessments reference it by `incidentId`.
Statuses: `documenting` → `analyzing` → `action_required` → `ready_to_file` → `filed` → `closed`. The open incident is the newest non-`closed` one; the first photo creates it (`getOrCreateOpenIncident`). `filed`/`closed` are set only by explicit user actions; the rest by `refreshIncidentStatus()`.

**ChatMessage:** `{ userId, vehicleId, role: "user" | "assistant", content, action? }`, survives refreshes and new sessions. `action = { tool, args, label, status: pending | running | done | failed | cancelled, result? }` is a guarded write waiting for the user's tap; a new user message cancels pending ones.

Store stable object keys, not just URLs.

---

## Cloud Storage

- Stores damage photos, uploaded vehicle photos and policy PDFs. All objects private.
- Client displays/downloads via short-lived presigned URLs; handle expired URLs gracefully.
- Validate MIME type and file size, generate safe keys (never raw user filenames).
- Google Cloud credentials stay server-side.

## Photos

**Take Photo** flow: Home → Camera → Review → Upload → AI Processing → Damage Visualization.

- Request camera + location. Capture client timestamp, GPS lat/lng/accuracy, vehicleId. Server records `serverReceivedAt`.
- Location denied → still allow the photo, show **"Location unavailable"**.
- Don't call browser GPS/timestamps "verified evidence". Record provenance honestly.

**No uploads.** Only Take Photo, so users can't submit old pictures. `source: "upload"` only exists on older data and is still shown as "Uploaded", never as a live capture. Desktop browsers ignore `capture`, so there Take Photo still opens a file picker.

**Gallery** (under the action buttons): a `<details>` dropdown ("Photos · N photos"), closed by default. Open: **+ Take photo** (same camera input as the Take Photo tile, `openCamera()`), then thumbnails (3-column grid on phones, horizontal scroll from `sm`) with optional badges (camera / uploaded / damage detected / location available). Tap → full-screen viewer with swipe, zoom, close, capture date, location status, the evidence seal, AI result. Don't show raw GPS coordinates prominently.

Built: `actions/photos.ts`: `createPhotoUpload` (presigned POST) → browser uploads to Cloud Storage → `registerPhoto` (idempotent per key) → `analyzeDamage()` in `services/ai/damage-analysis.ts` (keep its signature). It runs `prepareImage()` first; a file that isn't the declared image type gets the `unreadable` issue without a Gemini call. The viewer draws each part's box on the photo and shows the view. Take Photo uses the native `<input capture="environment">` (no in-app camera screen; a denied camera falls back to the file picker); location starts on the input's click, so every entry point records it. `registerPhoto` downloads the stored bytes once to hash/seal them and reuses them for `analyzeDamage`. If Gemini fails the photo is kept with `analysisStatus: "failed"` and can be retried (`retryPhotoAnalysis`); a photo stuck in `analyzing` for 3+ min shows as failed. Expired image URLs refresh once via `getPhotoViewUrl`.

## Damage analysis and 3D mapping

The 3D car is split into meshes with stable component IDs:

```
front_bumper  rear_bumper  hood  trunk  roof  windshield  rear_window
front_left_fender  front_right_fender  rear_left_quarter  rear_right_quarter
front_left_door  front_right_door  rear_left_door  rear_right_door
front_left_wheel  front_right_wheel  rear_left_wheel  rear_right_wheel
left_headlight  right_headlight  left_taillight  right_taillight
```

Gemini returns structured JSON, validated server-side with a schema before it's saved:

```json
{
  "view": "front_left",
  "damagedComponents": [
    {
      "component": "front_left_fender",
      "damageTypes": ["dent", "scratch"],
      "severity": "moderate",
      "confidence": 0.88,
      "description": "Visible dent and paint damage",
      "box_2d": [412, 80, 690, 455]
    }
  ],
  "summary": "Visible damage is concentrated around the front-left side.",
  "needsManualReview": false
}
```

Three.js deterministically turns matching meshes (today: position zones, see below) red. The model starts with no damage shown.

- Damage result cards show component, severity, damage types and AI confidence. Tapping a card rotates/focuses the car on that component.
- Tapping a red mesh shows component, description, severity, confidence and associated photos.
- 3D controls: rotate (drag/swipe/mouse), bounded zoom, reset view, X-ray toggle. The part detail card has **+ Take a close-up** (camera).

**Current state:** `components/vehicle/CarDamageView.tsx` (props unchanged: `{ damage: AggregatedDamage[]; focused?: ComponentId | null; onSelect?: (id: ComponentId) => void }`) lazy-loads `Car3D.tsx` (React Three Fiber, `useGLTF`, OrbitControls, no pan, bounded zoom) with a **3D / Map** toggle; Map is the keyboard-accessible 2D SVG (`CarDamageMap2D.tsx`), also shown if WebGL or the GLB fails. `DamageExplorer` wires the cards, the focus state and the detail panel.
- Models: one GLB per `CAR_MODELS` entry, credit line in the viewer + `public/models/ATTRIBUTION.md`. `lamborghini-sc18.glb` ("2019 Lamborghini SC18 Alston", Ddiaz Design, **CC BY-NC-SA 4.0: non-commercial only**, the team's part-grouped version, 9.4 → 2.5 MB) and `peugeot-308.glb` (2021 Peugeot 308, CC BY 4.0 per its Sketchfab metadata, 22 → 4.9 MB). Sources in `data/` (`2019_lamborghini_sc18_alston_fixed.glb`, `peugeot-308.glb`); optimized with `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --join false --palette false --instance false --simplify false` (keeps node/material names, which `partKind` reads). Both face +z with their left at +x.
- Garage background is a plain `bg-panel-shade` (no sky/grass behind the car).
- Meshes under a named part collection (`namedPart`, e.g. the Lambo's "Left Door", "Headlight - Left", "Windshield") map to that component exactly; everything else, `car-zones.ts` maps per vertex/tap to a component ID by its normalized position (front/back, left/right, height; thresholds in `ZONE`, orientation + credits per model in `CAR_MODELS`). `partKind` reads node + material names; its regexes skip "Trim", "Highlights" and "detail" so they aren't taken for rims, lights or taillights. Damaged zones are tinted per vertex by severity, except interior meshes (`isInterior`) and door glass, which stay clear; taps classify the hit point; selecting a part eases the camera to it. **X-ray** (a shared shader uniform) makes untinted surfaces see-through so damage stands out.
- Next step: name the remaining big parts in the GLBs (hood, trunk, bumpers, fenders, quarters) so `namedPart` covers them and zones are only a fallback.

**Processing UX:** retro step sequence, not an endless spinner, e.g. *Uploading evidence… → Inspecting vehicle… → Identifying visible damage… → Mapping vehicle components… → Updating your car…*

## Insurance

- The **Insurance** button sits on Home next to the photo buttons (label **"Add Insurance"** when the vehicle has no policy).
- Screen shows provider, policy info, uploaded PDF, upload/replace, AI summary, relevant coverage.
- PDF → private Cloud Storage → reference in MongoDB → Gemini extraction → structured data → simple summary.
- Users can also paste policy text instead of a PDF (`analyzePolicy({ text })` in `services/ai/policy-analysis.ts`, 200–60k chars). Store the pasted text in Cloud Storage as the original, same as a PDF.
- Extract when present: provider, policy type, premium, covered vehicle, collision, comprehensive, liability, deductibles, rental reimbursement, roadside assistance, other coverage, key exclusions/limitations.
- Missing fields say **"Not found in the uploaded policy"**. Never guess.
- Built: `/insurance` (no policy → pick insurer, then upload PDF or paste text; with policy → provider card, status, Retry/Replace, AI summary, coverage list). `actions/insurance.ts` runs `analyzePolicy()` then `summarizePolicy()` on the extraction only (never the raw doc). Unrelated documents throw `NotAPolicyError`.
- Originals open via `/insurance/original?vehicleId=` (owner-checked route that redirects to a fresh presigned URL), never a stored or pre-rendered URL.
- Pages whose actions call Gemini set `export const maxDuration` in the page file (not in `actions/*`). PDFs go to Gemini inline (base64); switch to the Files API if large PDFs fail.
- **Coverage checklist (ADK):** after a policy is processed, `checkCoverage()` runs an ADK agent over the extraction (+ `search_insurance_law` for Florida rules) and returns one item per peril. `enforceEvidence()` then keeps "covered" only when the named policy field has a value (else "unknown", shown as "Not found") and drops statute citations we don't have. Retry: `recheckCoverage`. Creating a vehicle now lands on `/insurance`.
- **Tuxemon attackers:** `CoverageChecklist.tsx` lists not-covered/unknown perils like the Damage list: the peril's Tuxemon on the left ("Agnidon may attack you"), details on the right; covered perils are a ✓ list. Sprites per peril in `components/insurance/peril-monsters.ts` (12 licensed Tuxemon, credits in `public/tuxemon/ATTRIBUTION.md`); the card must keep its sprite credits line.
- **No policy on hand:** "Pick your Florida plan" (`FloridaPlanPicker`) → `chooseFloridaPlan(vehicleId, planId)`; the insurance page labels it "Example Florida plan, not your actual policy".

## Chat

- One thread per vehicle. Context: vehicle info, policy + summary, photos, damage assessments, current incident, that vehicle's prior messages. The ADK agent can also read/act on the user's other vehicles through tools when the user names one (every tool checks `userId` ownership).
- Assistant is a friendly Tuxemon character (licensed asset, with attribution). Retro dialog-box bubbles. Friendly but not childish.
- Answers are concise by default. No authoritative coverage determinations the policy doesn't clearly support.
- Example questions: "What does my insurance cover?", "What's my deductible?", "Which parts look damaged?", "Do I need more photos?", "Where do I file my claim?", "Summarize everything that happened."
- Built: the assistant is **Propellercat** (Tuxemon, by tamashihoshi, CC BY-SA 4.0; credits in `public/tuxemon/ATTRIBUTION.md`). The chat page must keep showing `<TuxemonAttribution />`.
- `sendChatMessage(vehicleId, text)`; retry = resend the same text (the server reuses an unanswered identical last message). Gemini context comes from `buildVehicleContext()` in `services/ai/chat.ts` (`loadClaimState` + Vehicle, VIN last 4 only, claim link/phone only from `providers.ts`).
- The reply comes from the ADK agent (`runChatAgent`). Tools (`services/ai/agent-tools.ts`): read `list_vehicles`, `get_vehicle_status`, `list_photos`, `list_florida_plans`, `search_insurance_law`; write `update_incident_details`, `switch_vehicle`, `choose_florida_plan`, `set_insurer`; destructive `mark_claim_filed`, `close_incident`, `delete_photo`. Writes reuse the existing server actions, so their validation and state rules still apply. A write that needs the user's OK shows a Confirm/Cancel card under the reply (`resolveChatAction`).

## Summary tab and to-do list

Short cards, no long paragraphs: **Your Car**, **Damage**, **Insurance** (provider, coverage found, deductible), **Current Status**. The user should understand the situation in seconds.

**To-do list** recalculates automatically (no manual regenerate) when: vehicle created, policy uploaded/analyzed, photo captured/uploaded, damage assessment completed, incident info added, claim status changes.

Core tasks come from deterministic rules on app state:

| Condition | Task code |
|---|---|
| No policy | `UPLOAD_INSURANCE` |
| Policy not processed | `PROCESS_POLICY` |
| No photos | `ADD_PHOTOS` |
| Damage found, not enough angles | `ADD_DAMAGE_PHOTOS` |
| Required incident details missing | `COMPLETE_INCIDENT_INFO` |
| Everything required is present | `FILE_CLAIM` |

Gemini may improve wording or add context-specific suggestions, but must not add, remove or reorder core claim steps.

Examples:
- New vehicle, nothing uploaded → *Add your insurance policy*, *Take or upload photos of your vehicle*
- Damage photos, no insurance → *Upload your insurance policy*, *Add more photos of the damaged passenger side*
- Insurance + damage documented → *Review detected damage*, *Confirm your deductible*, *Start your insurance claim*
- Ready → checklist all ✓, then **"File your claim with State Farm"** + **[Start Claim]** opening the verified `claimsUrl`

Built: rules in `services/claims/todos.ts` (`computeTodos`, `MIN_DAMAGE_PHOTOS = 3`; `FILE_CLAIM` also needs a processed policy). AI-reworded to-dos are **not** built; the fixed copy is what users see. Claim status changes are user actions only: `markClaimFiled` requires the computed `readyToFile` → `filed`; `closeIncident` requires `filed` → `closed`; the next photo starts a new incident. Incident times go to the server as ISO strings; dates render with `components/summary/LocalTime` (user's timezone).

---

## UI and design

**Style:** a polished RPG companion (modeled on the HouseToClaim design) under an 8-bit pixel sky: an asphalt road sidebar (yellow center line, green highway-sign active item, crosswalk), white rounded cards, slate text, blue primary actions, restrained red brand, pixel crashed-car logo (`BrandMark` → `public/logo.png`), gold highlights. Pixel art frames the work (scenery, pixel scenes, Tuxemon sprites, pixel icons, stepped progress) but never sits behind body text. Playful but trustworthy enough for insurance documents.

**Tokens and utilities** live only in `app/globals.css` (light `:root` + dark `[data-theme="dark"]`). Road tokens (`--road`, `--road-ink(-soft)`, `--road-line`, `--road-paint`, `--road-sign(-ink)`) + `road-sign` utility for the sidebar. Colors: `panel`, `panel-shade`, `ink`, `ink-soft`, `muted`, `border`, `input`, `accent` (+`-hover/-soft/-ink`), `brand`, `gold`, `danger/ok/warn` (+`-soft`, use `bg-warn-soft text-warn` for chips), `pixel-outline`, `pixel-panel`. Utilities: `surface-card`, `pixel-frame` (nameplates on scenes), `pixel-scene`, `eyebrow`, `page-title`, `page-description`, `section-title`, `field-label/-hint/-input/-select`, `task-card`, `fade-in`, `appear`, `face-a/face-b`, `tux-front` (set by `TuxemonAvatar`: plays `<name>-idle.png`, the sheet's still frame under reduced motion), `tux-wild` (staggered entrance, `--tux-delay`), `pulse-ring`. No raw hex outside pixel art.

**Type:** Rubik for everything readable; Tektur (`font-display`) only for page/card titles, nameplates and short display numbers, never for policy/body text. Cards rounded-xl with a thin border, controls rounded-lg (44px min), chips rounded-full. No thick retro borders or hard offset shadows except `pixel-frame`.

**Environments:**
- Light: 8-bit day sky (`components/layout/SceneBackground.tsx`: blue gradient from `--sky-top/--sky-bottom`, blocky `.pixel-cloud`s, square sun) + asphalt road sidebar (white edge lines, dashed yellow center line along the content edge that shifts one dash per page change, crosswalk at the bottom). Text placed directly on the sky uses `text-ink` (and the darker light-theme `--brand` for eyebrows) to pass AA.
- Dark: night sky with twinkling square stars and a square moon, the same road at night, dark slate cards, night lighting on the 3D car. Not inverted colors.
- `public/scenery/`: `ground.svg` (original art reused from the team's HouseToClaim project, no credit needed; used by `.pixel-scene`) and `car.svg` (original pixel car). Tuxemon sprites keep their attribution.
- Login scene car: `components/auth/IdleCar.tsx`, `car.svg` inlined with round wheels; idles with a 1px body hop (`car-idle`) and two-frame spinning hubs (`wheel-a/b`), still under reduced motion.

**Navigation:** three destinations: **Home**, **Chat**, **Summary**, plus the **Vehicles** list (switch car / add vehicle). Phones: frosted bottom nav Home · Vehicles · Chat · Summary, where Vehicles opens a popover list above the nav. `md`+: road sidebar (`components/layout/AppSidebar.tsx`) with a "Vehicles" section above "Your car", and Profile, day/night and log out in its footer. The frosted header is phones-only (logo, day/night, profile avatar).

**Pages** start with `PageHeader` (`components/layout/PageHeader.tsx`: eyebrow, title, description, action) inside `space-y-6`; main is `max-w-5xl`, two columns at `lg` where it helps.

**Home layout (top to bottom):** vehicle header → next step → garage scene with the 3D car → action buttons → photo gallery → damage list.

Action buttons, grouped directly under the car, icon + short label:

```
[ Take Photo ] [ Insurance ]
```

**Retro components** (`components/retro`, same APIs, new look): `RetroCard`, `RetroButton`, `RetroDialog`, `RetroBadge`, `PixelProgress`, `RetroField`; plus `VehicleSelector`, `PhotoThumbnail`, `PhotoViewer`, `TodoCard`, `ChatBubble`, `TuxemonAssistant`, `StatusPanel`. Reuse them instead of page-specific buttons or cards.

## Auth

Sign up, log in, log out, profile. Protect authenticated routes. After login, go to the user's last-selected/default vehicle.

## Security

Sensitive data: policies, GPS, VIN, plates, damage photos, incident details, chat history.

Required: authentication, authorization with ownership checks on every resource, private Cloud Storage + signed URLs, upload MIME/size validation, safe object keys, server-side secrets. Never expose Google Cloud or MongoDB credentials to the client.

## Error states

Each state tells the user what to do next: camera denied, GPS denied, upload failure, invalid photo, invalid PDF, Gemini failure, damage not confidently identified, policy extraction failure, missing policy, missing photos, network failure, expired presigned URL, unsupported vehicle model.

## Demo data

Fictional seed user with:
- **2021 Peugeot 308** (`peugeot-308`): State Farm policy, front-left damage, several sealed camera photos, existing chat history.
- **2019 Lamborghini SC18 Alston** (`lamborghini-sc18`): different insurer, no incident, no damage.

Switching between them must visibly change the 3D damage state, photos, insurance, chat, summary and to-dos.

---

## Build order

Status (2026-09-26): phases 1–6 built end-to-end (3D uses the zone-mapped sample GLB) except AI-reworded to-dos. UI restyled to the companion theme with a road sidebar. Google ADK agents added (tool-using chat with Jev write guard, coverage checklist with Tuxemon attackers, statute RAG, Florida plan catalog). Phase 7 not started.

1. ✅ **Foundation:** Next.js, TS, Tailwind, MongoDB, auth, file storage (now Cloud Storage), retro design system, light/dark environments, vehicle-context architecture.
2. ✅ **Home:** vehicle selector, garage, 3D car (sample GLB, zone-mapped), action buttons, gallery, full-screen viewer.
3. ✅ **Photo pipeline:** camera → GPS/time → review → Cloud Storage → MongoDB → Gemini → component IDs → MongoDB → red meshes.
4. ✅ **Insurance:** provider selection → PDF → Cloud Storage → MongoDB → Gemini extraction → coverage summary.
5. ✅ **Chat:** vehicle-scoped, Tuxemon avatar, persistent history, vehicle/policy/damage context.
6. ✅ **Summary:** status cards, deterministic to-dos (AI wording skipped), auto refresh, claim readiness, verified claim link.
7. **Polish:** loading/error/empty states, animation, mobile, accessibility, security review, performance.

**First vertical slice (build this before anything else):**
Login → select vehicle → Home → 3D car → Take Photo → Cloud Storage → metadata in MongoDB → Gemini damage analysis → validated component IDs → save assessment → meshes turn red → photo in gallery → Summary to-dos update.

**Then:** Insurance PDF → Cloud Storage → MongoDB → Gemini extraction → Summary updates → Chat answers about that vehicle/policy → to-dos recalculate → verified claim link when ready.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
