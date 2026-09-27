# BeCarful — Shared AI Context

> This file is the **single source of truth** for all AI coding assistants working on this project.
> It is referenced by `CLAUDE.md`, `GEMINI.md`, and `AGENTS.md`.
> Keep this file updated as the project evolves.

---

## Project Overview

**BeCarful** is a project under active development. 

<!-- TODO: Add a 1-2 sentence description of what BeCarful does -->
<!-- TODO: Add the primary language and framework -->

---

## Multi-AI Collaboration Protocol

This project uses **three AI tools** with distinct roles:

| Tool | Role | Config File | Primary Responsibility |
|------|------|------------|----------------------|
| **Antigravity** (Google) | Explainer | `GEMINI.md` | Explain code, review architecture, document decisions |
| **Claude Code** (Anthropic) | Coder | `CLAUDE.md` | Write, refactor, and debug code |
| **Codex** (OpenAI) | Coder | `AGENTS.md` | Write, refactor, and debug code |

### Role Details

**Antigravity (Explainer)**
- Reads and analyzes existing code
- Explains architecture, design patterns, and data flows
- Reviews pull requests and suggests improvements
- Writes documentation and ADRs (Architecture Decision Records)
- Does NOT write production code (only documentation and examples)

**Claude Code & Codex (Coders)**
- Write new features and fix bugs
- Refactor existing code
- Write tests
- Both follow the same coding standards (below) to ensure consistency
- Both must leave clear context for each other (see Handoff Protocol)

### Handoff Protocol

When any AI tool makes changes, it must:

1. **Commit messages**: Use conventional commits format: `type(scope): description`
   - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`
   - Example: `feat(auth): add JWT token refresh endpoint`

2. **Inline comments**: For non-obvious logic, add a brief `// Why:` comment
   ```
   // Why: Rate limit is 100/min per user, not global, so we key by user ID
   ```

3. **TODO markers**: Use `// TODO(tool-name):` to leave notes for specific tools
   ```
   // TODO(claude): Refactor this to use the repository pattern
   // TODO(codex): Add error handling for network timeouts
   // TODO(antigravity): Document the retry strategy in the architecture docs
   ```

4. **Change log**: For significant changes, update the relevant section in this file

---

## Tech Stack

<!-- Update this section as the project takes shape -->

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | *TBD* | |
| Framework | *TBD* | |
| Testing | *TBD* | |
| Linter/Formatter | *TBD* | |
| Package Manager | *TBD* | |
| Database | *TBD* | |
| CI/CD | *TBD* | |

---

## ⛔ Code Boundary Rule

> **ALL source code lives in `cv-module/`. Do NOT create, modify, or delete any code files outside of `cv-module/`.**

This is a hard rule for all AI tools (Claude Code, Codex, and Antigravity). The only files outside `cv-module/` that may be edited are:
- `docs/AI_CONTEXT.md` — shared project context (documentation only)
- `README.md` — project README (documentation only)
- `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` — AI tool configs (only when updating collaboration rules)

Everything else — features, tests, utilities, configs, assets — goes inside `cv-module/`.

---

## Directory Structure

```
BeCarful/
├── cv-module/          # ⬅ ALL source code goes here
│   └── ...             # Features, tests, configs, assets
├── docs/               # Documentation (including this file)
│   └── AI_CONTEXT.md   # This file — shared AI knowledge base
├── CLAUDE.md           # Claude Code configuration
├── GEMINI.md           # Antigravity configuration
├── AGENTS.md           # Codex configuration
└── README.md           # Human-facing project README
```

---

## Coding Standards

All AI coders (Claude Code and Codex) must follow these rules:

### General Rules
- Write clean, readable code with meaningful variable and function names
- Keep functions small and focused — one function, one responsibility
- Add type annotations/hints where the language supports them
- Handle errors explicitly — no silent failures
- Write tests for new functionality

### Naming Conventions
- **Files**: `snake_case` for most languages, `kebab-case` for web assets
- **Functions/Methods**: `snake_case` (Python, Ruby, Rust) or `camelCase` (JS/TS, Java, Go)
- **Classes/Types**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Boolean variables**: Prefix with `is_`, `has_`, `can_`, `should_`

### Code Organization
- Group imports: stdlib → third-party → local (with blank lines between groups)
- Keep files under 300 lines — split if larger
- Co-locate tests with source code or in a parallel `tests/` directory

### Documentation
- Every public function/method needs a docstring/JSDoc
- Complex algorithms get a `// Why:` comment explaining the approach
- Architecture decisions are documented in `docs/`

---

## Common Commands

<!-- Update these as the project develops -->

```bash
# Install dependencies
# TBD

# Run the project
# TBD

# Run tests
# TBD

# Lint / format
# TBD

# Build
# TBD
```

---

## Architecture Decisions

<!-- Record key architectural decisions here so all AI tools stay aligned -->

### ADR-001: Multi-AI Collaboration
- **Date**: 2026-09-26
- **Decision**: Use three AI tools with distinct roles (Antigravity=explainer, Claude Code & Codex=coders)
- **Rationale**: Leverages each tool's strengths. Shared context file prevents drift between tools.

### ADR-002: Frontend as a separate Next.js app in `cv-module/frontend/`
- **Date**: 2026-09-26
- **Decision**: Build the 3D car viewer with Next.js (Turbopack) + React Three Fiber in its own `frontend/` folder. Vite is used only through Vitest. The frontend has no database layer.
- **Rationale**: Next.js cannot run on Vite, so Turbopack is its bundler. A subfolder keeps the frontend separate from the Python backend in `cv-module/`. The backend owns data storage, so the frontend will call its API instead of connecting to a database.

### ADR-003: Damage visualization contract (part IDs + 0–1 score)
- **Date**: 2026-09-26
- **Decision**:
  - The frontend uses the backend's `PartId` values (`cv_module/domain/enums.py`) as its part names. `cv-module/frontend/src/lib/car/car-parts.test.ts` fails if the two lists drift apart.
  - The frontend shows a report of `{ partId, score }` entries, with `score` from 0 to 1.
  - The score maps to a configurable number of levels (`DAMAGE_LEVEL_COUNT`, currently 6), colored green (lowest) to dark red (highest).
  - Left/right means the driver's left/right, facing forward.
- **Rationale**:
  - One naming scheme from model output to UI means no mapping layer.
  - A continuous score lets the number of levels change without retraining or changing the API.
- **Open points for the backend** (TODO(codex)):
  1. The backend has no per-part numeric damage score yet. It only has `VisualSeverity`, 3 levels, plus a confidence score. The future model or API needs to provide a 0–1 score per part.
  2. `PartId` has no rear side windows (`window_rear_left/right`), so the frontend draws them as plain, non-clickable glass.
  3. Confirm that the backend also uses the driver's-view left/right convention.

### ADR-004: Development-only local camera upload
- **Date**: 2026-09-26
- **Decision**: Test mobile camera capture through a Next.js `POST /api/upload` route that writes validated photos to `cv-module/frontend/public/uploads/` only outside production. The production Python backend remains responsible for Firebase Authentication and signed Google Cloud Storage uploads.
- **Rationale**: This isolates verification of the browser camera and multipart upload flow from unfinished cloud infrastructure without creating an unauthenticated production upload endpoint.

### ADR-005: CV preprocessing runs inside the BeCarful app
- **Date**: 2026-09-27
- **Decision**: `services/image_processing.py`'s checks (type sniffing, EXIF orientation, quality thresholds, normalization) are ported to `src/services/ai/image-prep.ts` in the app and run before every damage analysis. View and evidence boxes come from the app's single Gemini damage call; the app keeps its own component IDs. This is the one exception to the code boundary rule.
- **Rationale**: On real photos, unrotated phone images made the app's analysis swap left/right; the port fixed it without running a second backend.

---

## Change Log

| Date | Tool | Change | Details |
|------|------|--------|---------|
| 2026-09-26 | Antigravity | Initial setup | Created multi-AI collaboration infrastructure |
| 2026-09-26 | Claude Code | Frontend 3D car viewer | Added `cv-module/frontend/` (Next.js 16, three.js, Vitest) with a white procedural Suzuki XL7, orbit camera, auto-rotate, reset view and opening doors. See ADR-002 |
| 2026-09-26 | Claude Code | Frontend damage visualization | Split the 3D car into the 30 backend `PartId` parts. Parts are colored by damage level (6-level green→dark red scale, configurable) and clickable, with a legend and damaged-parts list. Sample data only for now. See ADR-003 |
| 2026-09-26 | Codex | Local camera upload test | Added a development-only Next.js camera upload flow that saves validated test photos under `frontend/public/uploads/`. See ADR-004 |
| 2026-09-26 | Claude Code | Intake prompt v2 (prompt set `v3`) | End-to-end test on 20 CarDD train images: `intake-v1` marked damage close-ups (`close_up`, `extreme_close_up`) unusable, so 5/20 claims ended `needs_more_photos` with no damage assessment. `intake-v2.txt` makes view and usability independent and keeps close-ups usable. Result: 20/20 assessed; recall rose for dent (0.75→1.00), crack (0.50→0.75), glass_shatter (0.67→1.00), lamp_broken (0.33→1.00) with unchanged precision. `prompt_version` is now `v3` (intake-v2 + assessment-v2) |
| 2026-09-26 | Claude Code | Frontend vehicle-mismatch message | When `review_reasons` contains `vehicle_inconsistency`, the backend skips damage inference. The damage panel showed "No visible damage findings." — it now says damage was not assessed because the photos show different vehicles (`lib/assessment/assessment-outcome.ts`) |
| 2026-09-27 | Claude Code | Removed `cv-module/frontend/` | The BeCarful app at the repo root is the only UI. ADR-002–004 describe the removed frontend |
| 2026-09-27 | Claude Code | CV preprocessing in the app | Ported image checks to `src/services/ai/image-prep.ts`; damage analysis now returns view + boxes. See ADR-005 |
