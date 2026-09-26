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

### Frontend (`cv-module/frontend/`)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript (strict) | |
| Framework | Next.js 16 (App Router, Turbopack), React 19 | Next 16 has breaking changes — read `cv-module/frontend/node_modules/next/dist/docs/` before writing Next code |
| 3D | three.js + `@react-three/fiber` + `@react-three/drei` | Procedural white Suzuki XL7 placeholder; a `.glb` can replace it via `CAR_MODEL_URL` |
| Styling | CSS Modules + `globals.css` | No Tailwind |
| Testing | Vitest + Testing Library (jsdom) | Vite is used only through Vitest |
| Linter/Formatter | ESLint (next config) + Prettier | Double quotes, semicolons |
| Package Manager | npm | |
| Database | None | Frontend has no DB layer; data will come from the backend API |

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
│   ├── frontend/       # Next.js + three.js 3D car viewer (see its README.md)
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

### Frontend (`cv-module/frontend/`)

```bash
cd cv-module/frontend
npm install        # install dependencies
npm run dev        # dev server on http://localhost:3000
npm test           # Vitest unit tests
npm run lint       # ESLint
npm run format     # Prettier
npm run build      # production build
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

---

## Change Log

| Date | Tool | Change | Details |
|------|------|--------|---------|
| 2026-09-26 | Antigravity | Initial setup | Created multi-AI collaboration infrastructure |
| 2026-09-26 | Claude Code | Frontend 3D car viewer | Added `cv-module/frontend/` (Next.js 16, three.js, Vitest) with a white procedural Suzuki XL7, orbit camera, auto-rotate, reset view and opening doors. See ADR-002 |
| 2026-09-26 | Claude Code | Frontend damage visualization | Split the 3D car into the 30 backend `PartId` parts. Parts are colored by damage level (6-level green→dark red scale, configurable) and clickable, with a legend and damaged-parts list. Sample data only for now. See ADR-003 |
