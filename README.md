# BeCarful

<!-- TODO: Add project description here -->

---

## 🤖 AI-Assisted Development

This project uses three AI coding assistants with distinct roles:

| Tool | Role | What It Does |
|------|------|-------------|
| **Antigravity** (Google) | 🔍 Explainer | Explains code, reviews architecture, writes documentation |
| **Claude Code** (Anthropic) | 💻 Coder | Writes features, fixes bugs, refactors code |
| **Codex** (OpenAI) | 💻 Coder | Writes features, fixes bugs, refactors code |

### How It Works

All three tools share a single knowledge base at [`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md) that keeps them aligned on:
- Project architecture and tech stack
- Coding standards and naming conventions  
- Build/test/run commands
- Collaboration and handoff protocols

Each tool also has its own config file that defines its specific role:
- [`CLAUDE.md`](CLAUDE.md) — Claude Code instructions
- [`GEMINI.md`](GEMINI.md) — Antigravity instructions
- [`AGENTS.md`](AGENTS.md) — Codex instructions

### For Contributors

- **Writing code?** Follow the coding standards in [`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md)
- **Using AI tools?** The config files are already set up — just open the project in your preferred AI tool
- **Leaving notes for an AI?** Use `// TODO(tool-name):` comments:
  - `// TODO(claude):` — for Claude Code to handle
  - `// TODO(codex):` — for Codex to handle
  - `// TODO(antigravity):` — for Antigravity to document