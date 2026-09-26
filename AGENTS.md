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
- Use strict TypeScript. Keep UI, business logic, DB access, S3, AI services, insurer metadata and 3D visualization separate.
- Never commit secrets. Add every new env var to `.env.example`.

## Status and commands

The repo is currently empty (LICENSE + README). The first agent to scaffold the app fills in this section:

```
# install / dev / build / lint / test / seed — TBD
```

### Decisions log

| Topic | Decision |
|---|---|
| Auth library | TBD |
| Schema validation (Gemini output, API input) | TBD (e.g. Zod) |

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

Next.js (App Router) · React · TypeScript (strict) · Tailwind CSS · MongoDB + Mongoose · AWS S3 · Gemini API · React Three Fiber / Three.js · Vercel

## Core principles (non-negotiable)

1. **Everything is vehicle-centric.** Photos, insurance, chat, summary, to-dos and 3D damage state belong to the selected vehicle. Switching vehicles switches the whole app context.
2. **Mobile first.** Assume the user is standing next to a damaged car: big controls, minimal typing, fast camera, one-handed use, short AI answers, clear progress, no dense dashboards, no unnecessary modals.
3. **AI assists; app state controls workflow.** Critical workflow state is deterministic code, not LLM output.
4. **AI does not paint the car.** Gemini returns standard component IDs; Three.js maps IDs to known meshes.
5. **S3 stores files; MongoDB stores references + structured data.** Never put photos/PDFs in MongoDB.
6. **S3 is private.** Use presigned URLs or server-side access, never public URLs.
7. **Never hallucinate policy coverage.** Unknown → "Not found in the uploaded policy".
8. **Never blindly trust AI-generated insurer URLs.** Use maintained provider metadata; validate any AI-suggested URL against the insurer's official domain.
9. **Preserve original evidence.** Never overwrite original photos when making thumbnails or AI-processing copies.
10. **Summary is actionable.** It answers: What happened? What does my policy say? What am I missing? What should I do next?
11. **Tuxemon, not Pokémon.** No Pokémon characters, sprites, logos, fonts, maps or sounds. Use only license-compatible Tuxemon assets and keep their attribution/license notices.
12. **End-to-end first.** A working Photo → S3 → AI → component ID → 3D damage → Summary pipeline beats many half-done features.

---

## Project structure

Feature-oriented. Starting point (improve if App Router conventions suggest better):

```
app/
components/  retro/ vehicle/ photos/ insurance/ chat/ summary/
lib/
models/
schemas/
services/    ai/ storage/ insurance/ vehicles/ claims/
types/
```

Key service files:

- `services/storage/s3.ts` — all S3 access (upload, presigned URLs, key generation)
- `services/ai/damage-analysis.ts`, `policy-analysis.ts`, `chat.ts`, `summary.ts` — one Gemini service per responsibility, never one giant prompt

## Environment variables

Server-side only. Keep `.env.example` current.

```
MONGODB_URI=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
GEMINI_API_KEY=
# + whatever the chosen auth library needs
```

---

## Data model

Likely Mongoose models: `User`, `Vehicle`, `InsuranceProvider`, `InsurancePolicy`, `Incident`, `DamagePhoto`, `DamageAssessment`, `ChatSession`/`ChatMessage`, `TodoState`.

- Every vehicle-related query enforces **both `userId` ownership and `vehicleId`**. A vehicle's data must never leak into another vehicle's context (especially chat).
- Use references, not duplicated data. Add indexes (e.g. `{ userId, vehicleId }`).
- Persist the user's last-selected vehicle.

**Vehicle:** year, make, model, trim?, color, VIN?, license plate, state.

**DamagePhoto:**
```ts
{ vehicleId, incidentId, s3Key, imageUrl, source: "camera" | "upload",
  capturedAt, serverReceivedAt, latitude, longitude, locationAccuracy, createdAt }
```

**InsurancePolicy:**
```ts
{ vehicleId, providerId, s3Key, documentUrl, uploadedAt, extractedData, aiSummary }
```

**InsuranceProvider:** `{ name, logo, claimsUrl, phone, supportedStates }`. Seed several; **State Farm** is the preferred/demo insurer. `claimsUrl` comes from maintained metadata.

**Incident:** userId, vehicleId, insurancePolicyId, type, date/time, location, photos, damage assessment, user notes, status, createdAt, updatedAt.
Statuses: `documenting` → `analyzing` → `action_required` → `ready_to_file` → `filed` → `closed`.

**Chat:** persisted in MongoDB per `{ userId, vehicleId }`, survives refreshes and new sessions.

Store stable S3 keys, not just URLs.

---

## S3 storage

- Stores damage photos, uploaded vehicle photos and policy PDFs. All objects private.
- Client displays/downloads via short-lived presigned URLs; handle expired URLs gracefully.
- Validate MIME type and file size, generate safe keys (never raw user filenames).
- AWS credentials stay server-side.

## Photos

**Take Photo** flow: Home → Camera → Review → Upload → AI Processing → Damage Visualization.

- Request camera + location. Capture client timestamp, GPS lat/lng/accuracy, vehicleId. Server records `serverReceivedAt`.
- Location denied → still allow the photo, show **"Location unavailable"**.
- Don't call browser GPS/timestamps "verified evidence". Record provenance honestly.

**Upload Photo:** existing photos from device, `source: "upload"`. Never present uploads as live captures.

**Gallery** (under the action buttons): horizontal scroll of small thumbnails with optional badges (camera / uploaded / damage detected / location available). Tap → full-screen viewer with swipe, zoom, close, capture/upload date, location status, AI result. Don't show raw GPS coordinates prominently.

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
  "damagedComponents": [
    {
      "component": "front_left_fender",
      "damageTypes": ["dent", "scratch"],
      "severity": "moderate",
      "confidence": 0.88,
      "description": "Visible dent and paint damage"
    }
  ],
  "summary": "Visible damage is concentrated around the front-left side.",
  "needsManualReview": false
}
```

Three.js deterministically turns matching meshes red. The model starts with no damage shown.

- Damage result cards show component, severity, damage types and AI confidence. Tapping a card rotates/focuses the car on that component.
- Tapping a red mesh shows component, description, severity, confidence and associated photos.
- 3D controls: rotate (drag/swipe/mouse), bounded zoom, reset view.

**Processing UX:** retro step sequence, not an endless spinner, e.g. *Uploading evidence… → Inspecting vehicle… → Identifying visible damage… → Mapping vehicle components… → Updating your car…*

## Insurance

- The **Insurance** button sits on Home next to the photo buttons (label **"Add Insurance"** when the vehicle has no policy).
- Screen shows provider, policy info, uploaded PDF, upload/replace, AI summary, relevant coverage.
- PDF → private S3 → reference in MongoDB → Gemini extraction → structured data → simple summary.
- Extract when present: provider, policy type, covered vehicle, collision, comprehensive, liability, deductibles, rental reimbursement, roadside assistance, other coverage, key exclusions/limitations.
- Missing fields say **"Not found in the uploaded policy"**. Never guess.

## Chat

- Scoped to the selected vehicle only. Context: vehicle info, policy + summary, photos, damage assessments, current incident, that vehicle's prior messages.
- Assistant is a friendly Tuxemon character (licensed asset, with attribution). Retro dialog-box bubbles. Friendly but not childish.
- Answers are concise by default. No authoritative coverage determinations the policy doesn't clearly support.
- Example questions: "What does my insurance cover?", "What's my deductible?", "Which parts look damaged?", "Do I need more photos?", "Where do I file my claim?", "Summarize everything that happened."

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

---

## UI and design

**Style:** Tuxemon + 16-bit retro RPG UI on top of modern mobile UX. Pixel-art environment, RPG menus, chunky cards, retro dialog boxes, pixel icons, low-poly 3D car. Playful but trustworthy enough for insurance documents.

**Environments:**
- Light: daytime sky, soft pixel clouds, outdoor scene, garage/service station.
- Dark: a real night scene (dark sky, stars, moon, dim garage lights, night lighting on the 3D car), not just inverted colors.
- UI and the car stay highly readable in both.

**Navigation:** only three tabs: **Home**, **Chat**, **Summary**. Retro bottom nav on mobile. Selected vehicle always visible with an easy switcher. Profile/avatar top-right.

**Home layout (top to bottom):** garage environment → 3D car → vehicle info → action buttons → photo gallery.

Action buttons, grouped directly under the car, icon + short label:

```
[ Take Photo ] [ Upload Photo ]       wide:  [ Take Photo ] [ Upload Photo ] [ Insurance ]
[ Insurance ]
```

**Retro components** (reusable, consistent borders/shadows/spacing/type): `RetroCard`, `RetroButton`, `RetroDialog`, `RetroBadge`, `PixelProgress`, `VehicleSelector`, `DamageBadge`, `PhotoThumbnail`, `PhotoViewer`, `InsuranceCard`, `TodoCard`, `ChatBubble`, `TuxemonAssistant`, `StatusPanel`.

Pixel fonts for headings/labels only. Long policy text uses a readable font.

## Auth

Sign up, log in, log out, profile. Protect authenticated routes. After login, go to the user's last-selected/default vehicle.

## Security

Sensitive data: policies, GPS, VIN, plates, damage photos, incident details, chat history.

Required: authentication, authorization with ownership checks on every resource, private S3 + presigned URLs, upload MIME/size validation, safe S3 keys, server-side secrets. Never expose AWS, Gemini or MongoDB credentials to the client.

## Error states

Each state tells the user what to do next: camera denied, GPS denied, S3 upload failure, invalid photo, invalid PDF, Gemini failure, damage not confidently identified, policy extraction failure, missing policy, missing photos, network failure, expired presigned URL, unsupported vehicle model.

## Demo data

Fictional seed user with:
- **2025 Toyota Camry XSE**: State Farm policy, front-left damage, several photos, existing chat history.
- **2023 Honda Civic**: different insurer, no incident, no damage.

Switching between them must visibly change the 3D damage state, photos, insurance, chat, summary and to-dos.

---

## Build order

1. **Foundation:** Next.js, TS, Tailwind, MongoDB, auth, S3, retro design system, light/dark environments, vehicle-context architecture.
2. **Home:** vehicle selector, garage, 3D car, action buttons, gallery, full-screen viewer.
3. **Photo pipeline:** camera → GPS/time → review → S3 → MongoDB → Gemini → component IDs → MongoDB → red meshes.
4. **Insurance:** provider selection → PDF → S3 → MongoDB → Gemini extraction → coverage summary.
5. **Chat:** vehicle-scoped, Tuxemon avatar, persistent history, vehicle/policy/damage context.
6. **Summary:** status cards, deterministic + AI-assisted to-dos, auto refresh, claim readiness, verified claim link.
7. **Polish:** loading/error/empty states, animation, mobile, accessibility, security review, performance.

**First vertical slice (build this before anything else):**
Login → select vehicle → Home → 3D car → Take/Upload Photo → S3 → metadata in MongoDB → Gemini damage analysis → validated component IDs → save assessment → meshes turn red → photo in gallery → Summary to-dos update.

**Then:** Insurance PDF → S3 → MongoDB → Gemini extraction → Summary updates → Chat answers about that vehicle/policy → to-dos recalculate → verified claim link when ready.
