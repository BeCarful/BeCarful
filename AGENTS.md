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
npm run seed -- --peugeot   # redo only the demo Peugeot's seeded walkaround photos, keeps the rest of the account
npm run ingest      # load statutes (data/florida, data/federal) + insurer policy forms (data/<providerId>/*.txt, with Vertex embeddings; waits out the embedding quota) into Mongo; rerun after editing them
npm run eval:rag    # policy RAG test set (eval/policy-rag.csv) against Mongo: hit@4 for keyword, vector and hybrid (needs a prior ingest)
npm run dev         # http://localhost:3000
npm run build
npm run lint
npm run typecheck   # next typegen + tsc
npm test            # node:test via tsx (all **/*.test.ts: claim rules, damage merge, car sides, dashboard readiness, multi-policy claim/coverage, 3D zones, statute search, policy form search, Jev guard, coverage rules, photo seal, share tokens, claim check, image prep, speech text, chat stream reader, silence detector)
npm run voices:design [tuxemon…]    # ElevenLabs Voice Design previews from each Tuxemon's look → MP3s in $TMPDIR/becarful-voice-design (uses credits)
npm run voices:design -- save <tuxemon> <n>   # save preview n as a voice in the ElevenLabs account, prints the VOICES line to paste
python3 scripts/tuxemon-idle.py   # regenerate the Tuxemon animations in public/tuxemon/ (needs Pillow + numpy)
python3 scripts/sample-policies.py   # regenerate public/samples/state-farm-florida-*.pdf (needs Google Chrome + Pillow)
```

**Google Cloud** (Vertex AI for Gemini + Cloud Storage for files): `brew install --cask gcloud-cli`, then `gcloud auth application-default login --impersonate-service-account=<app service account>`. Signed upload/view URLs need a service account, so plain user ADC is not enough; you need Service Account Token Creator on it. The app service account needs Vertex AI User on the project and Storage Object Admin on the bucket. Vercel: Workload Identity Federation (Vercel OIDC, team issuer, pool/provider `vercel`, condition limited to project `be-carful`) impersonating the same service account, which also needs Token Creator on itself to sign URLs. Set `GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT_EMAIL` on Vercel.

**Bucket** (private: uniform access + public access prevention). CORS for browser uploads (signed POST policy): `gcloud storage buckets update gs://<bucket> --cors-file=cors.json` with
`[{"origin":["http://localhost:3000","https://<your-app>.vercel.app"],"method":["POST"],"responseHeader":["Content-Type"],"maxAgeSeconds":3600}]`.

### Decisions log

| Topic | Decision |
|---|---|
| Auth library | None: `jose` HS256 JWT in an httpOnly `session` cookie + `bcryptjs` (`lib/session.ts`, `lib/auth.ts`). `proxy.ts` only sends signed-out visitors to /login (cookie signature check; `/login`, `/signup` and `/share/*` are public); the auth layout sends signed-in users home via the DB-backed `getCurrentUser()`, so a signed cookie for a deleted user (e.g. after `npm run seed`) can't loop /login ↔ /. Every page/action still calls `requireUser()`/`requireVehicle()`. |
| Schema validation (Gemini output, API input) | Zod v4. Gemini uses `responseJsonSchema: z.toJSONSchema(schema)` and the same schema validates the reply (`services/ai/gemini.ts#generateJson`). |
| Mutations / data loading | Server Actions in `actions/*.ts` (return `ActionResult<T>`), server components read via services. No REST API. Exceptions are route handlers that stream or redirect: `POST /chat/stream`, `GET /chat/speak`, `GET /insurance/original`. |
| Chat model + streaming | Every chat/voice reply uses `CHAT_MODEL` = `gemini-3.8-flash` (`services/ai/gemini.ts`) with `thinkingLevel: LOW` and default temperature (Gemini 3 guidance), and always streams: `runAgent(..., { onText })` runs ADK with `StreamingMode.SSE`, and `POST /chat/stream` sends NDJSON (`delta` {text, fresh} → `done` {user, reply} or `error`). `fresh` restarts the visible text after a tool call, so what streams matches the saved reply (the last final text). Client: `streamChat()` (`components/chat/stream.ts`, tested). Non-chat Gemini work (damage, policy, coverage) stays on `GEMINI_MODEL`. |
| Uploads | Browser → Cloud Storage signed POST policy (V4; the bucket enforces type + size, avoids Vercel's 4.5 MB body limit) → action registers the key after `isOwnedKey` + `headObject`. |
| Presigned URLs | Never stored; `getViewUrl(key)` on read (1 h). DB stores `s3Key` only (no `imageUrl`/`documentUrl` fields). |
| Insurer metadata | Static `services/insurance/providers.ts` (not a DB collection); `InsurancePolicy.providerId` is its string id. |
| To-dos | Computed on read by `computeTodos()` (pure, tested); no stored `TodoState`. Incident status synced by `refreshIncidentStatus()`. |
| Selected vehicle | `User.lastVehicleId`, changed by `selectVehicle()`; pages read it via `getVehicleContext()`. Switched from the "Vehicles" list (`VehicleSelector`): on `md`+ a sidebar section that shows the selected car (link to /garage) with a chevron that expands the other cars in a scrolling list (4½ rows) plus Add vehicle; on phones a bottom-nav tab that opens a native `popover` (`VehicleMenu`). Tapping a car selects it and opens `/garage` (the only way to the 3D car). Summary also has a row of car chips (`CarSwitcher`: nickname + plate) that switches cars in place, and dashboard cards use `OpenCar` (select, then open a page). |
| Car name | `Vehicle.nickname` (required in `VehicleForm`, max 30) is the display name everywhere: `vehicleTitle()` returns it, falling back to year/make/model for cars added before nicknames. `vehicleModel()` is year/make/model, shown under the name and sent to chat/agent tools as `model`. |
| Multiple policies | A car can have any number of active `InsurancePolicy` docs; none is "main". **Replace** updates that doc in place (new file, old object deleted), **Remove** deletes it + its object. The claim insurer is `claimPolicy()` (`services/claims/policies.ts`, tested): the processed policy whose checklist covers the incident's peril, else the first processed one. To-dos use the best status any policy reached (`policiesStatus`); coverage gaps use `combinedCoverage` (covered by any policy wins). |
| Car models | Static demo catalog `services/vehicles/car-models.ts` (`CAR_MODELS`: id, year/make/model, GLB url, axes, credit), not a DB collection. New vehicles must pick one (`Vehicle.modelId`, year/make/model copied from the catalog) in `VehicleForm`'s type-to-filter picker (`CarPicker`: a custom ARIA combobox, since `<datalist>` can't be styled; words match in any order, arrows/Enter/Esc, a hidden `modelId` holds the matched id); vehicles without `modelId` show the first model. Besides the 4 cars with their own GLB, `STAND_INS` adds ~20 demo cars (Corolla, Mustang, 911…) that borrow the closest real model's GLB + credit so the picker looks full. |
| Photo evidence | Camera only: in-app `getUserMedia` camera (`PhotoCapture`), no file input anywhere, and `registerPhoto` rejects `source: "upload"`. On receipt the server stores `sha256` of the stored bytes and `seal` = HMAC-SHA256 (`AUTH_SECRET`) over vehicleId + sha256 + capturedAt + serverReceivedAt + location (`services/photos/seal.ts`, tested). It proves the bytes and metadata are unchanged since BeCarful received them, not that the device clock/GPS were true. No verify UI yet. |
| Evidence sharing | Bearer link `/share/<token>` per incident, not an emailed code (no email provider): 32 random bytes, only the SHA-256 is stored, so the owner sees a link once. Expires after 1/7/30 days (Mongo TTL index deletes it), **Stop sharing** deletes it. The page is public, `noindex` + `no-referrer`, and shows photos (fresh 1 h signed URLs), incident, vehicle (VIN last 4) and the AI damage list as an estimate. Sent from the user's own share sheet / clipboard / `mailto:`. |
| 3D car | R3F + drei GLB viewer (`Car3D.tsx`) behind `CarDamageView`, one GLB per catalog model. Parts come from named collections where the GLB has them (`namedPart`: "Left Door", "Headlight - Right", "Windshield"…), else position zones (`car-zones.ts`). The team's prototype (`3d_model_update/`) was folded in and removed: its collection highlight, "damage skips glass/interior" rule, transparency toggle (now **X-ray**) and per-part photo panel (now **+ Take a close-up**, camera only). 2D map (`CarDamageMap2D.tsx`) is the toggle + error fallback. |
| Design system | HouseToClaim-style tokens + Tailwind v4 `@utility` classes in `globals.css`; no component library. Fonts: Rubik (body) + Tektur (display) via `next/font`. |
| Agents | Google ADK for TypeScript (`@google/adk`): chat (`services/ai/chat-agent.ts`) and coverage checklist (`services/ai/coverage.ts`) are `LlmAgent`s with `FunctionTool`s. `runAgent()` (`services/ai/adk.ts`) rebuilds an in-memory ADK session per request from MongoDB history. `serverExternalPackages: ["@google/adk"]` (its optional peer deps break bundling). |
| Voice | ElevenLabs over plain `fetch` (`services/ai/voice.ts`), not its Conversational AI agents, so voice goes through the same ADK agent and per-vehicle thread as typed chat. Speech-to-text: `transcribeSpeech` action → Scribe `scribe_v2` (browser `MediaRecorder`, 30 s max, ≤ 900 KB). Text-to-speech: owner-checked `GET /chat/speak?id=<assistant message id>` streams `eleven_flash_v2_5` MP3, so only the user's own replies can be spoken. No `ELEVENLABS_API_KEY` → voice UI hidden. The voice comes from the user's chosen Tuxemon (`assistantById(user.assistantId).voiceId`), and the audio URL carries `&v=<assistant id>` so a cached reply isn't replayed in the old voice after a switch. The mapped voices are ElevenLabs default voices (usable by any account, checked with this project's key). ElevenLabs retires its default voices on 2026-12-31: swap the ids in `VOICES` before then (Voice Library → Add to My Voices → Copy voice ID). |
| Agent write guard | Jev (TypeSafe AI, `POST /v1/systemone`) classifies each non-read tool call in `beforeToolCallback`; code decides via `decide()` (`services/ai/guard.ts`, tested): reads run, `destructive` tools always wait for a Confirm tap, writes run alone only when Jev says benign + requested, confident "suspicious" is blocked, no key/outage → Confirm. A waiting write is stored as `ChatMessage.action` and run once by `resolveChatAction`. |
| Law RAG | Statute chunks live in the `statutes` collection (`Statute` model, filled from `data/florida` + `data/federal` by `npm run ingest`); `statuteIndex()` loads them once per server instance into an in-memory BM25 index (`services/law/statutes.ts`, tool `search_insurance_law`). Empty collection → the tool throws "Run npm run ingest". Tests index the files directly. Swap for embeddings if recall suffers. |
| Policy RAG | Insurer policy wording (State Farm only: booklet 9810C + endorsements as `personal_car`, Classic+ collector forms as `classic_plus`) lives in `policyforms` (`PolicyForm`), filled by `npm run ingest` from `data/<providerId>/*.txt` (title + `Form:`/`Product:`/`Source:` header). Chunks follow the form's own sections (`splitSections` in `services/insurance/policy-forms.ts`: part › subsection › numbered coverage, one chunk per definition, ≤2500 chars; State Farm part titles are a whitelist) and carry `section` + defined `term`. Search = BM25 + `gemini-embedding-2` (768-d, stored per chunk, cosine in memory) fused by reciprocal rank; a query-embedding failure falls back to BM25 (60 s pause after a 429). Scope: the forms on the user's declarations (`PolicyExtraction.formNumbers`), else the insurer's `personal_car`/`classic_plus` forms, labeled as standard wording. Results attach definitions of the terms they use. Test set in `eval/policy-rag.csv` (2026-09-27 with `gemini-embedding-2`: keyword 23/32, vector 32/32, hybrid 28/32; `gemini-embedding-001` had vector 31, hybrid 30; `npm test` guards keyword ≥ 23). Why `gemini-embedding-2`: the project's `gemini-embedding` quota is 5 requests/min and an increase was auto-denied (not enough usage history), while `gemini-embedding-2` allows 300k/min. It ignores `taskType` (the task goes in the text as a prefix, `PREFIX` in `embeddings.ts`) and merges several texts in one request into one vector, so `embed()` sends one text per request, 8 at a time. Changing the model means rerunning `npm run ingest`. Not used by the coverage checklist. |
| Storage | Google Cloud Storage (`@google-cloud/storage`, `services/storage/gcs.ts`), replacing AWS S3. Same functions as before; the `s3Key` field name stays (it's the object key). It is in `serverExternalPackages`: bundled, its `node-fetch@2` `url.parse()` ran from `.next/` and Node 24 printed DEP0169 on every Storage call. |
| Gemini auth | Vertex AI only: `genaiAuth()` in `services/ai/gemini.ts` (`GOOGLE_CLOUD_PROJECT`, location `global`, model `GEMINI_MODEL` constant), Application Default Credentials locally; on Vercel `googleAuthOptions()` (`lib/gcp.ts`) swaps in a Vercel OIDC external-account credential for both Storage and GenAI. ADK reuses the shared `gemini()` client (`adkModel()` overrides `apiClient`) because its `Gemini` class takes no auth options. |
| Florida plans | Static, sourced `services/insurance/florida-plans.ts` (4 example configurations per insurer, retrieved 2026-09-26, no premiums). Picking one stores its text as the policy original, sets `planId` and skips Gemini extraction. |
| Photo preprocessing | Ported from the former Python `cv-module` (since removed) to `sharp` (`services/ai/image-prep.ts`): bytes must match the declared type, EXIF orientation applied (unrotated phone photos made Gemini swap left/right), low-res/dark/bright/blurry checks, ≤2048px JPEG to Gemini. View + part boxes come from the same Gemini call (`box_2d`, 0–1000). |
| npm | npm 11 writes `package-lock.json`; `deploy.yml` installs npm@11 before `npm ci`, because npm 10 (Node 22's) rejects the lockfile over mongodb's optional `gcp-metadata` peer. Use npm 11+ locally too. |
| Dev origin | `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` so the dev server also hydrates when opened via 127.0.0.1 (Next 16 blocks dev assets from other hostnames). |
| Tuxemon animation | Full-body sprites play a looping APNG (`public/tuxemon/<name>-idle.png`) generated by `scripts/tuxemon-idle.py` from the unmodified sheet's front frame: breathing/floating, blinks, per-creature motion. Chat faces (`TuxemonFace`) play `<name>-face.png`, or `<name>-talk.png` while typing/streaming a reply (`talking`), made from the sheet's two menu frames. Tune a sprite's settings there and rerun; the adaptation is credited in `ATTRIBUTION.md` and the on-screen credit lines. |

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

Feature-oriented. All application code lives in `src/` (Next.js `src` folder; `@/*` → `./src/*`). File paths elsewhere in this doc are relative to `src/` unless they start with `public/`, `data/`, `scripts/` or `eval/`. Config files, `public/`, `data/`, `scripts/`, `eval/` and `.env*` stay at the repo root.

```
src/app/(auth)/        login, signup
src/app/share/[token]/ public evidence page for a share link (no auth, outside both route groups)
src/app/(app)/         authed shell (layout: sky, road sidebar md+ with the Vehicles list, frosted header on phones, bottom nav + Vehicles popover on phones)
  page.tsx             Dashboard (landing)   summary/   garage/ (3D car)  chat/  insurance/  profile/  vehicles/new/  crash/
src/actions/           server actions per feature: auth vehicles photos insurance chat incidents
src/components/        retro/ layout/ auth/ vehicle/ photos/ insurance/ chat/ summary/ crash/
src/lib/               env (zod, lazy), gcp (Vercel WIF credentials), db (cached mongoose), session (jose), auth, upload-client
src/models/            User Vehicle InsurancePolicy Incident DamagePhoto DamageAssessment ChatMessage Statute PolicyForm
src/schemas/           zod: damage, policy, vehicle
src/services/          ai/ storage/ insurance/ vehicles/ claims/ law/ share/
src/types/             shared constants + types (component IDs, statuses, task codes)
src/proxy.ts           optimistic auth redirect (Next 16 name for middleware)
scripts/seed.ts        demo data
scripts/ingest.ts      statute + policy form chunks (with embeddings) → Mongo
scripts/design-voices.ts  ElevenLabs Voice Design for the Tuxemon voices (descriptions in LOOKS)
eval/                  policy-rag.csv (retrieval test set: question, product, form/section/text regexes, case-insensitive, empty = any; a hit = a top-4 chunk matching all three), cases.ts (CSV loader, also used by npm test), policy-rag.ts (hit@4 report)
scripts/sample-policies.py  demo State Farm declarations PDFs → public/samples/
public/                becarful-logo.png (brand logo; favicon is app/icon.png)  logo/ (square insurer icons: statefarm, geico, allstate; Allstate's is the hands emblem cropped from its wordmark)  samples/ (demo State Farm declarations PDFs)  scenery/ (grass, ground, pixel car SVGs)  tuxemon/ (sprite sheets, generated *-idle.png animations + ATTRIBUTION.md)  models/ (catalog GLBs lamborghini-sc18, peugeot-308, waymo-firefly, bmw-e92 + ATTRIBUTION.md)
data/                  RAG source texts, one .txt per statute section (citation + source URL header): florida/ (2026 F.S.: ch. 627 Part XI, ch. 324, related sections), federal/ (2024 U.S. Code), state-farm/ (Florida OIR IRFS filing PDFs named <file log #>_<doc id>.pdf; policy wording extracted to one .txt per form: 9810C-personal-car-policy.txt, 2281A/2289F/2835AR/2030AR/1012826 (filing 24-098215) and the approved Classic+ SC-*.txt forms (filing 25-056482); memos, letters, emails, sample declarations and REPLACED versions are left out), source GLBs of the catalog cars (not served), becarful-logo-source.png (unedited logo art), peugeot-308/ (normal/ clean and crashed/ photos, seeded as the demo Peugeot's walkaround and crash photos)
```

Key service files:

- `services/storage/gcs.ts` — all Cloud Storage access (signed POST uploads, `isOwnedKey`, signed view URLs, key generation)
- `services/ai/gemini.ts` — shared client + `generateJson()` (structured output validated by Zod)
- `services/ai/damage-analysis.ts`, `policy-analysis.ts`, `chat.ts` — one Gemini service per responsibility, never one giant prompt
- `services/ai/adk.ts` (ADK model + `runAgent`), `chat-agent.ts` (chat agent + guard), `agent-tools.ts` (every tool the agent can call, with `kind`: read / write / destructive), `coverage.ts` + `coverage-rules.ts` (coverage agent + deterministic evidence check), `guard.ts` (Jev + `decide`), `voice.ts` (ElevenLabs speech-to-text + text-to-speech)
- `services/law/statutes.ts` — statute chunking (`readStatuteFiles`) + BM25 search over the `statutes` collection (the BM25 helpers are generic)
- `services/insurance/policy-forms.ts` — section-aware policy form chunking (`readPolicyForms`) + form-scoped hybrid search over `policyforms`; `eval/policy-rag.csv` is its retrieval test set
- `services/ai/embeddings.ts` — Vertex `gemini-embedding-2` embeddings (task prefix, one text per request, unit vectors, optional quota retries)
- `services/claims/todos.ts` — deterministic to-do rules + incident status (pure, tested); `state.ts` loads a vehicle's claim state; `damage.ts` merges per-photo assessments; `claim-check.ts` checks evidence + policy behind a claim (pure, tested), `claimCheckFor()` in `state.ts` feeds it
- `services/vehicles/context.ts` — `getVehicleContext()` for pages, `requireVehicle(vehicleId)` ownership gate for every vehicle-scoped action
- `services/vehicles/car-models.ts` — demo car catalog (`CAR_MODELS`, `carModel(id)`), shared by the form, actions, seed and `Car3D`
- `services/photos/seal.ts` — `sha256Hex` + `sealPhoto` (photo evidence HMAC)
- `services/share/token.ts` (share token + expiry, pure, tested), `evidence.ts` (`loadSharedEvidence` for the public page, `listShareLinks`)

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
ELEVENLABS_API_KEY=    # optional, assistant voice (speech-to-text + text-to-speech); without it chat is text only
```

---

## Data model

Mongoose models in `models/`: `User`, `Vehicle`, `InsurancePolicy`, `Incident`, `DamagePhoto`, `DamageAssessment`, `ChatMessage`, `EvidenceShare`, plus `Statute` (shared law text, not user data: `{ citation, url, jurisdiction, text }`) and `PolicyForm` (insurer standard wording, not user data: `{ providerId, product, form, citation, section, term?, source, text, embedding }`). Insurer metadata is code (`services/insurance/providers.ts`), to-dos are computed (no `TodoState`), chat is one thread per vehicle (no `ChatSession`).

- Every vehicle-related query enforces **both `userId` ownership and `vehicleId`**. A vehicle's data must never leak into another vehicle's context (especially chat). Every child doc stores `userId` + `vehicleId`; actions get both from `requireVehicle(vehicleId)`.
- Use references, not duplicated data. Add indexes (e.g. `{ userId, vehicleId }`).
- Persist the user's last-selected vehicle (`User.lastVehicleId`).

**User:** email (unique), name, passwordHash (`select: false`), lastVehicleId, assistantId? (chat buddy; unset = Propellercat).

**Vehicle:** userId, modelId (catalog id), nickname (display name), year, make, model, trim?, color, vin?, licensePlate, state.
Deleting one (`deleteVehicle`, **Remove** on Profile → Garage, inline confirm) deletes its share links, then its Cloud Storage prefix `users/<userId>/vehicles/<vehicleId>/`, then its photos, assessments, incidents, policies and chat, then the vehicle; `lastVehicleId` moves to the newest remaining vehicle (or null). No cascade in Mongo itself, and no transaction (works on a standalone `mongo:7`); a failed delete can simply be retried.

**DamagePhoto:**
```ts
{ userId, vehicleId, incidentId, s3Key, contentType, source: "camera" | "upload",
  capturedAt?, serverReceivedAt, latitude?, longitude?, locationAccuracy?, sha256?, seal?,
  analysisStatus: "pending" | "analyzing" | "done" | "failed", createdAt }
```
Deleting one (`deletePhoto`: **Delete photo** in the photo viewer with inline confirm, or the chat's `delete_photo` tool behind Confirm) removes the photo doc, its `DamageAssessment` and the Cloud Storage object, then re-runs `refreshIncidentStatus()`. No schema/index change; no transaction.

**DamageAssessment:** one per analyzed photo: `{ userId, vehicleId, incidentId, photoId, view, damagedComponents[] (optional 0–1 `box` each), summary, needsManualReview, photoIssues[], aiModel }`. `photoIssues` (`PHOTO_ISSUES`) come from code, not Gemini, and force `needsManualReview`. The car's damage state = `aggregateDamage()` over the open incident's assessments (worst severity per component).

**InsurancePolicy:**
```ts
{ userId, vehicleId, providerId, s3Key, fileName, uploadedAt,
  status: "processing" | "processed" | "failed", extractedData: PolicyExtraction | null, aiSummary, error?,
  coverageChecklist: { items: CoverageItem[], generatedAt } | null, planId? }
```
`CoverageItem = { peril, status: "covered" | "not_covered" | "unknown", detail, law: { citation, url } | null }`, one per `PERILS` (types/index.ts: collision, liability, injury, uninsured_driver, theft, fire, flood, storm, vandalism, animal, glass, roadside).
Every policy of a vehicle is active (`getPolicies`, oldest first); see **Multiple policies** in the decisions log.

**Insurance providers:** `PROVIDERS` in `services/insurance/providers.ts`: `{ id, name, shortName, color, logo?, claimsUrl, phone, officialDomains, supportedStates }`. `ProviderMark` shows `logo` (full-bleed square icon) if set, else a `shortName` tile. Wherever the app shows an insurer's name it shows the icon too: `ProviderName` (icon + name) on the Summary Insurance card, claim box and Insurance title; `WithProviderLogo` swaps the name inside to-do / next-step text. Chat text stays plain. **State Farm** (`state-farm`) is the preferred/demo insurer (hackathon sponsor; its emblem is used with that permission). State Farm, GEICO and Allstate have icons in `public/logo/`; the others still show `shortName` tiles. `isOfficialUrl()` validates any URL against `officialDomains`.

**Incident:** userId, vehicleId, insurancePolicyId (legacy, no longer written), type (`INCIDENT_TYPES`), occurredAt, location, notes, status, filedAt. Photos/assessments reference it by `incidentId`.
Statuses: `documenting` → `analyzing` → `action_required` → `ready_to_file` → `filed` → `closed`. The open incident is the newest non-`closed` one; the first photo creates it (`getOrCreateOpenIncident`). `filed`/`closed` are set only by explicit user actions; the rest by `refreshIncidentStatus()`.

**EvidenceShare:** `{ userId, vehicleId, incidentId, tokenHash (unique), label?, expiresAt (TTL index), openCount, lastOpenedAt? }`. One per share link; the page shows that incident's photos live, so deleted photos disappear from it. Max 10 live links per incident. `openCount` includes mail-app link previews.

**ChatMessage:** `{ userId, vehicleId, role: "user" | "assistant", content, action? }`, survives refreshes and new sessions. `action = { tool, args, label, status: pending | running | done | failed | cancelled, result? }` is a guarded write waiting for the user's tap; a new user message cancels pending ones.

Store stable object keys, not just URLs.

---

## Cloud Storage

- Stores damage photos, uploaded vehicle photos and policy PDFs. All objects private.
- Client displays/downloads via short-lived presigned URLs; handle expired URLs gracefully.
- Validate MIME type and file size, generate safe keys (never raw user filenames).
- Google Cloud credentials stay server-side.

## Photos

**Take Photo** flow: Garage → Camera → Review → Upload → AI Processing → Damage Visualization.

- Request camera + location. Capture client timestamp, GPS lat/lng/accuracy, vehicleId. Server records `serverReceivedAt`.
- Location denied → still allow the photo, show **"Location unavailable"**.
- Don't call browser GPS/timestamps "verified evidence". Record provenance honestly.

**No uploads.** Only Take Photo, so users can't submit old pictures. `source: "upload"` only exists on older data and is still shown as "Uploaded", never as a live capture. There is no file picker: a blocked or missing camera shows an error with **Try again**, never a picker.

**Gallery** (under the action buttons): a `<details>` dropdown ("Photos · N photos"), open by default. Open: thumbnails (the Take Photo tile above is the only camera button) (3-column grid on phones, horizontal scroll from `sm`) with optional badges (camera / uploaded / damage detected / location available). Tap → full-screen viewer with swipe, zoom, close, capture date, location status, the evidence seal, AI result. Don't show raw GPS coordinates prominently.

Built: `actions/photos.ts`: `createPhotoUpload` (presigned POST) → browser uploads to Cloud Storage → `registerPhoto` (idempotent per key) → `analyzeDamage()` in `services/ai/damage-analysis.ts` (keep its signature). It runs `prepareImage()` first; a file that isn't the declared image type gets the `unreadable` issue without a Gemini call. The viewer draws each part's box on the photo and shows the view. Take Photo opens an in-app camera (`PhotoCapture`: `getUserMedia` rear camera, live preview, shutter draws the frame to a JPEG; needs HTTPS or localhost); `openCamera()` starts it from any entry point, and location starts at the same time. `registerPhoto` downloads the stored bytes once to hash/seal them and reuses them for `analyzeDamage`. If Gemini fails the photo is kept with `analysisStatus: "failed"` and can be retried (`retryPhotoAnalysis`); a photo stuck in `analyzing` for 3+ min shows as failed. Expired image URLs refresh once via `getPhotoViewUrl`.

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

- **Condition list** (`DamageExplorer`, one list for damage + walkaround): damaged parts first (most severe first), then Front / Rear / Left side / Right side. Every item is a collapsible `<details>`: the part's photos plus the latest clear photo of its side(s), damaged photos outlined red, clear ones green, capture time under each. Damage items show component, severity, damage types and AI confidence; opening one focuses the car on it, **Show on car** scrolls to it. A photo's sides come from Gemini's `view` (`front_left` → front + left), or its damaged parts when the view is unknown (`sidesOf()` in `services/claims/damage.ts`). A side's green photo is its newest analyzed photo with no damage and no manual review.
- Tapping a red mesh shows component, description, severity, confidence and associated photos.
- 3D controls: rotate (drag/swipe/mouse), bounded zoom, reset view, X-ray toggle. The part detail card has **+ Take a close-up** (camera).

**Current state:** `components/vehicle/CarDamageView.tsx` (props unchanged: `{ damage: AggregatedDamage[]; focused?: ComponentId | null; onSelect?: (id: ComponentId) => void }`) lazy-loads `Car3D.tsx` (React Three Fiber, `useGLTF`, OrbitControls, no pan, bounded zoom) with a **3D / Map** toggle; Map is the keyboard-accessible 2D SVG (`CarDamageMap2D.tsx`), also shown if WebGL or the GLB fails. `DamageExplorer` wires the cards, the focus state and the detail panel.
- Models: one GLB per `CAR_MODELS` entry, credit line in the viewer + `public/models/ATTRIBUTION.md`. `lamborghini-sc18.glb` ("2019 Lamborghini SC18 Alston", Ddiaz Design, **CC BY-NC-SA 4.0: non-commercial only**, the team's part-grouped version, 9.4 → 2.5 MB), `peugeot-308.glb` (2021 Peugeot 308, CC BY 4.0 per its Sketchfab metadata, 22 → 4.9 MB) and `waymo-firefly.glb` (2015 Waymo Firefly, bought on Freecreat: **no redistribution**, part-named `waymo_organized.glb` with Left/Right swapped because it was named from the front view, 10.5 → 1.9 MB) and `bmw-e92.glb` (2011 BMW M3 E92, fvrenbld, CC BY 4.0, the team's part-grouped version, 8.6 → 2.5 MB). Sources in `data/` (`2019_lamborghini_sc18_alston_fixed.glb`, `peugeot-308.glb`, `bmw_e92_organized.glb`; the Waymo source is gitignored, ask the team for it); optimized with `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --join false --palette false --instance false --simplify false` (keeps node/material names, which `partKind` reads). All face +z with their left at +x.
- Garage background is a plain `bg-panel-shade` (no sky/grass behind the car).
- Meshes under a named part collection (`namedPart`, e.g. the Lambo's "Left Door", "Headlight - Left", "Windshield") map to that component exactly; everything else, `car-zones.ts` maps per vertex/tap to a component ID by its normalized position (front/back, left/right, height; thresholds in `ZONE`, orientation + credits per model in `CAR_MODELS`). `partKind` reads node + material names; its regexes skip "Trim", "Highlights", "detail" and "Wheel Arch" so they aren't taken for rims, lights, taillights or wheels. Damaged zones are tinted per vertex by severity, except interior meshes (`isInterior`) and door glass, which stay clear (glass is never treated as interior: the BMW's BeamNG names use `_int` for intact glass); taps classify the hit point; selecting a part eases the camera to it. **X-ray** (a shared shader uniform) makes untinted surfaces see-through so damage stands out.
- Gemini's left/right on side-profile shots is unreliable: on `data/peugeot-308/normal` it swapped 3 of 4 side shots; the prompt's image-orientation rule (front points image-left → left side) brought it to 2–3 of 4, and it flags half-car crops for review. A sturdier fix is to ask which way the nose points and derive left/right in code.
- Next step: name the remaining big parts in the GLBs (hood, trunk, bumpers, fenders, quarters) so `namedPart` covers them and zones are only a fallback.

**Processing UX:** retro step sequence, not an endless spinner, e.g. *Uploading evidence… → Inspecting vehicle… → Identifying visible damage… → Mapping vehicle components… → Updating your car…*

## Insurance

- The **Insurance** button sits in the Garage next to the photo buttons (label **"Add Insurance"** when the vehicle has no policy).
- Screen shows provider, policy info, uploaded PDF, upload/replace, AI summary, relevant coverage.
- PDF → private Cloud Storage → reference in MongoDB → Gemini extraction → structured data → simple summary.
- Users can also paste policy text instead of a PDF (`analyzePolicy({ text })` in `services/ai/policy-analysis.ts`, 200–60k chars). Store the pasted text in Cloud Storage as the original, same as a PDF.
- Extract when present: provider, policy type, premium, covered vehicle, collision, comprehensive, liability, deductibles, rental reimbursement, roadside assistance, other coverage, key exclusions/limitations, policy form numbers (`formNumbers`, e.g. `9810C`; scopes the policy RAG).
- Missing fields say **"Not found in the uploaded policy"**. Never guess.
- Built: `/insurance` (no policy → pick insurer, then upload PDF or paste text; with policies → a tab per policy (`?policy=<id>`) plus **+ Add policy** (`?add=1`, same setup; saving opens the new tab); per policy: provider card, status, Retry/Replace/Remove, AI summary, coverage list; on `lg` insurer + policy | plain words + details side by side, then the checklist (two-column cards) and Coverage full width). `actions/insurance.ts` runs `analyzePolicy()` then `summarizePolicy()` on the extraction only (never the raw doc). Unrelated documents throw `NotAPolicyError`.
- Originals open via `/insurance/original?vehicleId=&policyId=` (owner-checked route that redirects to a fresh presigned URL), never a stored or pre-rendered URL.
- Pages whose actions call Gemini set `export const maxDuration` in the page file (not in `actions/*`). PDFs go to Gemini inline (base64); switch to the Files API if large PDFs fail.
- **Coverage checklist (ADK):** after a policy is processed, `checkCoverage()` runs an ADK agent over the extraction (+ `search_insurance_law` for Florida rules) and returns one item per peril. `enforceEvidence()` then keeps "covered" only when the named policy field has a value (else "unknown", shown as "Not found") and drops statute citations we don't have. Retry: `recheckCoverage(vehicleId, policyId)`. Creating a vehicle now lands on `/insurance`.
- **Tuxemon attackers:** `CoverageChecklist.tsx` lists not-covered/unknown perils like the Damage list: the peril's Tuxemon on the left ("Agnidon may attack you"), details on the right; covered perils are a ✓ list. Sprites per peril in `components/insurance/peril-monsters.ts` (12 licensed Tuxemon, credits in `public/tuxemon/ATTRIBUTION.md`); the card must keep its sprite credits line.
- **No policy on hand:** "Pick your Florida plan" (`FloridaPlanPicker`) → `chooseFloridaPlan(vehicleId, planId)`; the insurance page labels it "Example Florida plan, not your actual policy".
- **Sample policies to upload (demo only):** `public/samples/state-farm-florida-{minimum,liability,full,full-extras}.pdf`, one per State Farm example plan, served at `/samples/…`. Built by `scripts/sample-policies.py` on State Farm's filed Florida declarations template (P1010023 FL, `data/state-farm/24-098215_619466.pdf`) with coverage symbols, limits and wording from booklet 9810C; fictional insured/vehicle/VIN (`…SAMPLE00n`)/policy number (`999000n-…`)/premiums, a SAMPLE watermark image and a "not issued by State Farm" banner + footer on every page.

## Crash mode

`/crash` (red **Crash mode** button in the phone header). Step 1: Florida at-the-scene duties, most urgent first, each linking its statute: anyone hurt → Call 911 (`tel:911`, § 316.062), stay at the scene / clear the lanes (§ 316.061), call police if hurt or ≥ $2,000 damage (§ 316.065(1)), swap info (§ 316.062), no police report → own written report within 10 days (§ 316.066(1)(e)). Step 2 (`?step=photos`, `CrashPhotos`): a `<select>` of the user's vehicles (`selectVehicle`) + **Add photos**, which runs the normal `PhotoCapture` flow (seal, analysis, first photo opens the incident); "See my car" goes to `/garage`, **Exit to home** to `/` (Dashboard). Not in the `md`+ sidebar; on desktop it's reached from the Summary's **If something happens** card.

## Chat

- One thread per vehicle. Context: vehicle info (nickname + model), every policy + summary, `claimInsurer`, photos, damage assessments, current incident, that vehicle's prior messages. The ADK agent can also read/act on the user's other vehicles through tools when the user names one (every tool checks `userId` ownership).
- Assistant is a friendly Tuxemon character (licensed asset, with attribution). Retro dialog-box bubbles. Friendly but not childish.
- Answers are concise by default. No authoritative coverage determinations the policy doesn't clearly support.
- Example questions: "What does my insurance cover?", "What's my deductible?", "Which parts look damaged?", "Do I need more photos?", "Where do I file my claim?", "Summarize everything that happened."
- Built: the default assistant is **Propellercat** (Tuxemon, by tamashihoshi, CC BY-SA 4.0; credits in `public/tuxemon/ATTRIBUTION.md`). The chat page must keep showing `<TuxemonAttribution />` for the chosen assistant.
- `streamChat(vehicleId, text, onText)` → `POST /chat/stream`; retry = resend the same text (the server reuses an unanswered identical last message). Gemini context comes from `buildVehicleContext()` in `services/ai/chat.ts` (`loadClaimState` + Vehicle, VIN last 4 only, claim link/phone only from `providers.ts`).
- The reply comes from the ADK agent (`runChatAgent`). Tools (`services/ai/agent-tools.ts`): read `list_vehicles`, `get_vehicle_status`, `list_photos`, `list_florida_plans`, `search_insurance_law`, `search_policy_forms`; write `update_incident_details`, `switch_vehicle`, `choose_florida_plan`, `set_insurer`; destructive `mark_claim_filed`, `close_incident`, `delete_photo`. Navigation: `open_page` (in `chat-agent.ts`, not a data tool, so no guard) picks from a fixed page list (summary, garage, insurance, chat, profile, add_vehicle, crash_mode → `PAGE_HREF`). The path rides on the stream's `done` event, `streamChat` drops anything that isn't an in-app path, and the chat page, buddy box and voice bubble `router.push` it after the reply. Writes reuse the existing server actions, so their validation and state rules still apply. A write that needs the user's OK shows a Confirm/Cancel card under the reply (`resolveChatAction`).
- **Choose your assistant:** Profile → **Chat buddy** (`AssistantPicker` → `chooseAssistant`) picks one of the licensed Tuxemon in `components/chat/assistants.ts` (`ASSISTANTS` = Propellercat + the cute `COMPANIONS` Shybulb, Rockitten, Budaye, Anoleaf, Hatchling, Tumbleworm + the peril monsters; `assistantById()` falls back to Propellercat). The choice sets the buddy, chat avatars and name, the agent's name in `systemPrompt(name)`, and the "In plain words" avatar on Insurance. Each Tuxemon has its own ElevenLabs voice matched to its sprite (`VOICES` in `assistants.ts`: name, id, `speed`, sent as `voice_settings.speed`). Big creatures (Selmatek golem, Moloch tree, Bigfin whale) are deeper and slower, small ones (Vamporm grub, Chillimp imp) are brighter and quicker, Possessun the ghost is a storyteller, and Nut the machine is neutral. A test checks none is missing or shared and every speed is in ElevenLabs' 0.7–1.2 range. Profile → Chat buddy has a ▶ button per Tuxemon (voice name) that plays `/chat/speak?sample=<assistant id>`, a fixed greeting in that voice, without changing the pick. For custom creature voices, `npm run voices:design` generates Voice Design previews from each sprite's description (`LOOKS` in `scripts/design-voices.ts`); `save` keeps one and prints its `VOICES` line. Voices named "Custom" in `VOICES` (Shybulb, Rockitten, Budaye, Anoleaf, Hatchling, Tumbleworm) are youthful Voice Design voices saved in the ElevenLabs account that owns `ELEVENLABS_API_KEY` ("BeCarful <Name>"), so production must use a key from that same account. Every sprite shown keeps its credits via `<TuxemonAttribution monsters={…} />`.
- `Chat` in `components/chat/ChatThread.tsx` is the chat page. Under the suggestions, an **About** row lists each vehicle as a car chip plus its active policy's insurer chip (`chatSubjects()`), current vehicle first. Picking another vehicle calls `selectVehicle` (switches the whole app); the insurer chip switches the suggestions to insurance questions. The topic only changes suggestions and copy, not what the agent sees.
- **Voice** (when `ELEVENLABS_API_KEY` is set): mic button next to Send (tap to talk, tap to stop) and **Tap to talk** on an empty thread; a spoken question gets its reply read aloud, and every reply has **Listen**. `useVoice` plays one shared `Audio` element, unlocked with a silent clip on the mic tap so iOS lets the reply play after the wait. Recording stops by itself: a Web Audio analyser feeds `silenceDetector()` (`components/chat/vad.ts`, tested). It tracks the noise floor, counts sound over 3× the floor as speech, and stops 1.4 s after speech ends, or after 8 s with no speech (the audio is still sent in case the user spoke quietly). Tapping ■ and the 30 s cap still work. An analyser that only ever reads zeros is ignored, leaving tap-to-stop.
- **Chat buddy** (`ChatBuddy`, in the app layout): the user's assistant floats in the bottom-right corner of every authed page except `/chat`, bobbing in place (`buddy-bob`, still under reduced motion). Drag it (mouse or touch, 6 px threshold so a tap still opens the chat) to move it anywhere on screen; the spot is kept on screen on resize and remembered per browser in `localStorage` (`becarful:buddy-spot`). Under it are two round buttons. 💬 (or tapping the sprite) opens a small chat box next to it (`MiniChat`: 320 px, compact bubbles, recent messages from `loadChat(vehicleId)`, streamed replies, Confirm cards; ↗ opens `/chat`). 🎤 (only with an ElevenLabs key) records at once and sends when the user pauses (or on a second tap). A speech bubble shows "Listening… → Got it… → Thinking…", then the streamed reply, reads it aloud and offers **Play again**. Both pop-ups sit above or below the buddy, whichever has more room, clamped to the screen, and follow it when dragged. Esc/✕ closes and cancels any recording or playback.

## Dashboard

`/` (landing page, after login too). Stat tiles: Cars · Insured · Protected · Open cases. **Open cases** lists every car whose open incident has damage or is past `documenting`, with status, what happened, damaged parts, claim insurer and **Open case** (no next-step line or page description: keep it short). **Your cars**: one card per car with its insurers, a badge (Open case › Protected › Insured › Not insured) and a checklist from `readiness()` (`services/claims/todos.ts`, tested): policy on file (processed), coverage checked (any processed policy has a checklist), every side photographed (`documentedSides` over the open incident's assessments, 4/4). Protected = all three. Buttons: **Summary** and the first missing step, both via `OpenCar`. Loads `loadClaimState` per car.

## Summary tab and to-do list

`/summary`. Short cards, no long paragraphs. The user should understand the situation in seconds. Car chips (`CarSwitcher`, 2+ cars) switch the car without leaving the page. Header = the car (nickname, model, color, plate), then **Current status** (`StatusPanel`: status, a "What happened" recap of type · time · place, claim-step progress only while an incident is open, Next step). Then two cards that depend on the open incident:
- **Incident open:** **Damage** (`DamageCard`: non-interactive `CarDamageMap2D`, damaged parts with severity + damage types, latest 4 photos showing damage → `/garage`) and **Am I covered?** (`InsuranceCard`: the incident type's `INCIDENT_PERIL` row from each policy's `coverageChecklist`, covered first, each with its deductible; no type yet → link to `#incident`; `other` → no single peril).
- **No incident:** **Your policy/policies** (`InsuranceCard`: each policy's deductible, number and dates, then the top 3 perils no policy covers (`combinedCoverage`) with their Tuxemon + credits) and **If something happens** (Crash mode, call + verified claims page per insurer).

**To-do list** recalculates automatically (no manual regenerate) when: vehicle created, policy uploaded/analyzed, photo captured/uploaded, damage assessment completed, incident info added, claim status changes.

Core tasks come from deterministic rules on app state:

| Condition | Task code |
|---|---|
| No policy | `UPLOAD_INSURANCE` |
| Policy not processed | `PROCESS_POLICY` |
| No photos | `ADD_PHOTOS` |
| Damage found, fewer than 3 photos showing it | `ADD_DAMAGE_PHOTOS` |
| Required incident details missing | `COMPLETE_INCIDENT_INFO` |
| Everything required is present | `FILE_CLAIM` |

Gemini may improve wording or add context-specific suggestions, but must not add, remove or reorder core claim steps.

Examples:
- New vehicle, nothing uploaded → *Add your insurance policy*, *Take or upload photos of your vehicle*
- Damage photos, no insurance → *Upload your insurance policy*, *Add more photos of the damaged passenger side*
- Insurance + damage documented → *Review detected damage*, *Confirm your deductible*, *Start your insurance claim*
- Ready → checklist all ✓, then **"File your claim with State Farm"** + **[Start Claim]** opening the verified `claimsUrl`

Built: rules in `services/claims/todos.ts` (`computeTodos`, `MIN_DAMAGE_PHOTOS = 3` counts photos that show damage (`damagePhotoCount`), so walkaround photos in the same incident don't count; the claim box, Summary and chat use the same count; `FILE_CLAIM` also needs a processed policy). AI-reworded to-dos are **not** built; the fixed copy is what users see. Claim status changes are user actions only: `markClaimFiled` requires the computed `readyToFile` → `filed`; `closeIncident` requires `filed` → `closed`; the next photo starts a new incident. Incident times go to the server as ISO strings; dates render with `components/summary/LocalTime` (user's timezone). There is no separate "Your claim" card: `ClaimActions` (Start Claim, Call, Have ready, I've filed, Close incident; anchor `#claim`) renders inside the To-do card only when ready to file or filed, and Incident details sits beside the To-do card on `lg`. **Share evidence** (on `/summary`, anchor `#share`, shown once the open incident has photos): optional "who's it for" label + 1/7/30 days → `createShareLink` → the link once with Share… (`navigator.share`), Copy link and Email (`mailto:`); active links list opens and **Stop sharing** (`stopShareLink`).

---

## UI and design

**Style:** a polished RPG companion (modeled on the HouseToClaim design) under an 8-bit pixel sky: an asphalt road sidebar (yellow center line, green highway-sign active item, crosswalk), white rounded cards, slate text, blue primary actions, restrained red brand, pixel crashed-car logo (`BrandMark` → `public/becarful-logo.png`), gold highlights. Pixel art frames the work (scenery, pixel scenes, Tuxemon sprites, pixel icons, stepped progress) but never sits behind body text. Playful but trustworthy enough for insurance documents.

**Tokens and utilities** live only in `app/globals.css` (light `:root` + dark `[data-theme="dark"]`). Road tokens (`--road`, `--road-ink(-soft)`, `--road-line`, `--road-paint`, `--road-sign(-ink)`) + `road-sign` utility for the sidebar. Colors: `panel`, `panel-shade`, `ink`, `ink-soft`, `muted`, `border`, `input`, `accent` (+`-hover/-soft/-ink`), `brand`, `gold`, `danger/ok/warn` (+`-soft`, use `bg-warn-soft text-warn` for chips), `pixel-outline`, `pixel-panel`. Utilities: `surface-card`, `pixel-frame` (nameplates on scenes), `pixel-scene`, `eyebrow`, `page-title`, `page-description`, `section-title`, `field-label/-hint/-input/-select`, `task-card`, `fade-in`, `appear`, `tux-anim` (+ `tux-face` for 24px faces; set by `TuxemonAvatar`/`TuxemonFace`: plays `--tux-idle`, the sheet's still frame under reduced motion), `tux-wild` (staggered entrance, `--tux-delay`), `pulse-ring`. No raw hex outside pixel art.

**Type:** Rubik for everything readable; Tektur (`font-display`) only for page/card titles, nameplates and short display numbers, never for policy/body text. Cards rounded-xl with a thin border, controls rounded-lg (44px min), chips rounded-full. No thick retro borders or hard offset shadows except `pixel-frame`.

**Environments:**
- Light: 8-bit day sky (`components/layout/SceneBackground.tsx`: blue gradient from `--sky-top/--sky-bottom`, blocky `.pixel-cloud`s, square sun) + asphalt road sidebar (white edge lines, dashed yellow center line along the content edge that shifts one dash per page change, crosswalk at the bottom). Text placed directly on the sky uses `text-ink` (and the darker light-theme `--brand` for eyebrows) to pass AA.
- Dark: night sky with twinkling square stars and a square moon, the same road at night, dark slate cards, night lighting on the 3D car. Not inverted colors.
- `public/scenery/`: `ground.svg` (original art reused from the team's HouseToClaim project, no credit needed; used by `.pixel-scene`) and `car.svg` (original pixel car). Tuxemon sprites keep their attribution.
- Login scene car: `components/auth/IdleCar.tsx`, `car.svg` inlined with round wheels; idles with a 1px body hop (`car-idle`) and two-frame spinning hubs (`wheel-a/b`), still under reduced motion.

**Navigation:** **Dashboard** (`/`, the landing page, all cars), **Summary** (`/summary`) and **Chat**, plus the **Vehicles** list (tap a car → its Garage at `/garage` / add vehicle). Phones: frosted bottom nav Dashboard · Summary · Vehicles · Chat, where Vehicles opens a popover list above the nav. `md`+: road sidebar (`components/layout/AppSidebar.tsx`) with Dashboard on top, then a "Vehicles" section above "Your car", and Profile, day/night and log out in its footer. The frosted header is phones-only (logo, red **Crash mode** button in the middle, day/night, profile avatar).

**Pages** start with `PageHeader` (`components/layout/PageHeader.tsx`: eyebrow, title, description, action) inside `space-y-6`; main is `max-w-5xl`, two columns at `lg` where it helps.

**Claim check** (`components/vehicle/ClaimCheck.tsx`, collapsed `<details>` on `/garage` once the open incident is `ready_to_file` or `filed`): deterministic `checkClaim()` rows marked ✓ / ! / ✕ / i. Coverage for the incident's peril (`INCIDENT_PERIL`: hail/weather → storm, other → none) from the stored coverage checklist, never "covered" without it; example Florida plan; policy period from `effectiveDates` (ISO, MM/DD/YYYY or "Mar 1, 2026"; within a day of either end → "confirm"); deductible (info); damage photos vs `MIN_DAMAGE_PHOTOS`; uploaded vs live; missing location; damage photos before the incident time (prior damage) or 3+ days after; undamaged before photos (walkaround) count in its favor; unclear photos. Verdict: any ✕ → At risk, any ! → Some gaps, else Well supported. No payout probability or dollar estimate: the app has no claim outcomes or repair costs, and the card says the insurer decides.

**Garage layout (`/garage`, top to bottom):** vehicle header → next step → Claim check (only when ready to file or filed) → garage scene with the 3D car → action buttons → photo gallery → Condition list. On `lg`+ it's two columns: car on the left, buttons + Condition on the right, then Photos full width below; the Condition card (always shown) is as tall as the car (not Photos, so collapsing Photos doesn't shrink it) and its list scrolls (tapping a part scrolls to its card).

Action buttons, grouped directly under the car, icon + short label:

```
[ Take Photo ] [ Insurance ]
```

**Retro components** (`components/retro`, same APIs, new look): `RetroCard`, `RetroButton`, `RetroDialog`, `RetroBadge`, `PixelProgress`, `RetroField`; plus `VehicleSelector`, `PhotoThumbnail`, `PhotoViewer`, `TodoCard`, `ChatBubble`, `TuxemonAssistant`, `StatusPanel`. Reuse them instead of page-specific buttons or cards.

## Auth

Sign up, log in, log out, profile. Protect authenticated routes. After login, go to the Dashboard; per-car pages use the last-selected/default vehicle.

## Security

Sensitive data: policies, GPS, VIN, plates, damage photos, incident details, chat history.

Required: authentication, authorization with ownership checks on every resource, private Cloud Storage + signed URLs, upload MIME/size validation, safe object keys, server-side secrets. Never expose Google Cloud or MongoDB credentials to the client.

## Error states

Each state tells the user what to do next: camera denied, GPS denied, upload failure, invalid photo, invalid PDF, Gemini failure, damage not confidently identified, policy extraction failure, missing policy, missing photos, network failure, expired presigned URL, unsupported vehicle model.

## Demo data

Fictional seed user with:
- **2021 Peugeot 308** "Daily Pug" (`peugeot-308`, plate BCF2021): State Farm policy with a coverage checklist and a clean walkaround from two days ago: all 7 photos in `data/peugeot-308/normal` (front, rear, the four side halves, top), sealed with fake time + GPS, in a `documenting` incident with no damage, so it shows as **Protected** on the Dashboard. No crash photos. Existing chat history. The seed stores the true views, not Gemini's, and re-encodes the renders to 1080px JPEG because `prepareImage` flags anything under 720px as low resolution. Reseeding deletes the old demo account's Cloud Storage objects and share links first.
- **2019 Lamborghini SC18 Alston** "The Bull" (`lamborghini-sc18`): different insurer, no incident, no damage.

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
