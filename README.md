# Mingo AI — Phase 6

Mingo AI is an AI-powered software engineering platform. **Phase 1** delivered the production-ready
SaaS foundation (auth, project CRUD, MongoDB API). **Phase 2** added a per-project AI chat.
**Phase 3** added a browser-based IDE — a real file tree persisted in MongoDB, a Monaco editor,
tabs, save/autosave, search, and a command palette. **Phase 4** turned that file tree into a full
Workspace Engine — versioning, snapshots/restore, batch operations with preview, move/rename,
activity history, and a locking foundation. **Phase 5** added the Planner Agent — a natural-language
request in, a structured/validated `ProjectPlan` (requirements, stack, architecture, tasks) out,
still no code written. **Phase 6** (this phase) adds the **Frontend Agent**: it takes one approved,
frontend-typed task from the plan, generates real file operations through the Workspace Engine,
shows a diff preview, and applies them only after explicit user approval. See
[What's in Phase 6](#whats-in-phase-6) and
[What's intentionally not in Phase 6](#whats-intentionally-not-in-phase-6).

## Tech stack

| Layer      | Stack                                                                            |
| ---------- | --------------------------------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion, Zustand, React Hook Form, Zod, react-markdown, Monaco Editor, Prettier |
| Backend    | Node.js, Express, TypeScript, OpenAI SDK                                        |
| Database   | MongoDB Atlas + Mongoose                                                          |
| Auth       | Clerk (email/password, Google, GitHub, forgot-password, session sync via webhooks) |
| Testing    | Vitest (+ React Testing Library on the client)                                    |
| Deployment | Frontend → Vercel · Backend → Railway                                            |

## Monorepo layout

```
mingo-ai/
├── client/    Next.js 15 app (App Router)
├── server/    Express API
├── shared/    Types, enums, and Zod schemas shared by client & server
└── docs/      Architecture, API reference, setup guide
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together, and
[docs/API.md](docs/API.md) for the full REST API reference.

## Prerequisites

- Node.js 20+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier is enough)
- A [Clerk](https://clerk.com) application
- An [OpenAI](https://platform.openai.com) API key (for the AI chat — the rest of the app works
  without one, but chat requests will fail until `OPENAI_API_KEY` is set)

## Getting started

Full step-by-step instructions (creating the Clerk app, wiring the webhook, MongoDB Atlas setup)
are in **[docs/SETUP.md](docs/SETUP.md)**. Quick version:

```bash
npm install

# Fill in real values (Clerk keys, MongoDB URI, etc.)
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# Build the shared package once (server & client both consume its compiled output)
npm run build --workspace=shared

npm run dev
```

- Client: http://localhost:3000
- Server: http://localhost:8080

## Scripts (run from the repo root)

| Command                  | What it does                                                |
| ------------------------- | ------------------------------------------------------------ |
| `npm run dev`             | Builds `shared`, then runs `shared` (watch), `server`, and `client` concurrently |
| `npm run build`           | Builds `shared` → `server` → `client` in order               |
| `npm run typecheck`       | Type-checks all three workspaces                              |
| `npm run lint`            | Lints `client` and `server`                                    |

Each workspace also has its own scripts (`npm run dev --workspace=client`, etc.) if you want to run
a single piece in isolation — just make sure `shared` has been built at least once first. Each of
`client` and `server` also has `npm run test --workspace=<client|server>` (Vitest).

## Workspace keyboard shortcuts

Active only on `/projects/[id]/workspace` (`useWorkspaceKeyboardShortcuts`):

| Shortcut         | Action                  |
| ----------------- | ------------------------ |
| `Ctrl/Cmd + S`     | Save the active file     |
| `Ctrl/Cmd + P`     | Quick file search        |
| `Ctrl/Cmd + Shift + P` | Command palette       |
| `Ctrl/Cmd + Shift + F` | Search workspace (file contents) |
| `Ctrl/Cmd + B`     | Toggle file explorer      |
| `Ctrl/Cmd + J`     | Toggle bottom panel       |
| `Ctrl/Cmd + Shift + A` | Toggle AI chat panel  |
| `Ctrl/Cmd + W`     | Close the active tab (prompts to save if unsaved) |
| `Shift + Alt + F`  | Format document (Prettier) |

## What's in Phase 1

Landing page, Clerk authentication, a dashboard with sidebar navigation, project CRUD (create,
edit, archive, duplicate, delete) with search/filter/pagination, project templates, a profile page,
a settings page (theme, notifications, security via Clerk, account deletion), and a billing page
showing plan/usage.

## What's in Phase 2

A per-project AI chat: create/rename/delete conversations, send a message and watch the AI's reply
stream in token-by-token, stop an in-flight generation, retry a failed reply, Markdown + syntax
highlighting in assistant messages, and full conversation history that survives a refresh. The AI
is given the project's stored tech stack as context and answers specifically for it.

## What's in Phase 3

A per-project workspace at `/projects/[id]/workspace`: a VS Code-style file explorer (create,
rename, delete files/folders, sorted folders-first), a Monaco editor with a custom dark theme and
real syntax highlighting, multi-file tabs with unsaved-changes indicators and a close confirmation,
manual save (Ctrl+S) and debounced autosave, quick file search (Ctrl+P), workspace-wide content
search (Ctrl+Shift+F), a command palette (Ctrl+Shift+P), resizable panels, and a bottom
Output/Problems/Logs/Terminal panel foundation. The Phase 2 AI chat is docked on the right — it can
be given the current file or a Monaco text selection ("Ask Mingo AI") as context, but it only
explains and suggests; it never edits a file. Every new project gets a small stack-aware starter
file tree (see `starter-files.service.ts`). Full details in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/API.md](docs/API.md).

## What's in Phase 4

The Workspace Engine: per-file version history, whole-workspace snapshots with restore
(auto-backing-up current state first), atomic-in-spirit batch operations (create/update/delete/
rename/move) with a dry-run preview endpoint, move/rename with descendant path cascades, a
workspace activity log, and a TTL-based file-locking foundation (`lock.service.ts`) — built but not
enforced on any write path until Phase 6's Frontend Agent became its first real caller. Still MongoDB
only, still no real filesystem or command execution.

## What's in Phase 5

The Planner Agent: a natural-language request becomes a structured, Zod-validated, versioned
`ProjectPlan` — requirements, tech stack, architecture, features, database schema, API surface,
frontend structure, a dependency-ordered task graph, risks, and assumptions. Streamed progress over
SSE, bounded correction-prompt retries on invalid output, plan approve/reject, scoped field edits,
and a structural diff on regeneration. Planning only — no code is written and no other agent runs.

## What's in Phase 6

The Frontend Agent — the first agent that writes real code. It consumes one **approved**,
frontend-typed task from a Planner `ProjectPlan`, reads the relevant slice of the existing
workspace (actual file content, not just metadata), asks the AI for a structured set of file
operations, validates them hard (path traversal, secrets/`.git`/`node_modules` blocked, size/count
limits, bounded correction-prompt retries), and shows a diff preview (reusing Phase 4's
previously-unused `DiffViewerDialog`). Nothing is written to the workspace until the user clicks
**Apply Changes** — which snapshots the workspace first and applies the batch atomically through
Phase 4's existing `batch.service`/`preview.service`, rolling back via the snapshot if the apply
itself fails partway through. A task board shows live status per task
(ready/running/blocked/completed/failed), and every generation attempt is versioned — regenerating
with feedback never overwrites a previous proposal. A new "Bot" button in the Workspace IDE header
opens the panel. Full details in the "Frontend Agent" sections of
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/API.md](docs/API.md).

## What's intentionally not in Phase 6

Only the **Frontend Agent** exists — no Backend/Database/Testing/DevOps agents, and no multi-agent
orchestrator. The agent never runs shell commands, installs packages, executes code, uses a
terminal/Docker/sandbox, provides a live app preview, or touches Git/GitHub/deployment. Backend
tasks in a plan are explicitly rejected ("This task belongs to the Backend Agent, not the Frontend
Agent.") rather than attempted. `AI_AUTO_APPLY` exists as a documented config flag but nothing in
this phase consults it — apply is always an explicit, separate user action. Anthropic/Gemini AI
providers remain structurally supported but unimplemented — only OpenAI works today.
