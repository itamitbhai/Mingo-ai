# Mingo AI — Phase 2

Mingo AI is an AI-powered software engineering platform. **Phase 1** delivered the production-ready
SaaS foundation: authentication, a project management dashboard, and a MongoDB-backed API. **Phase
2** (this phase) adds a per-project AI chat system — streaming conversations with an AI that knows
each project's stack — on top of that foundation. Code execution, file editing, and deployment are
still out of scope; see [What's intentionally not in Phase 2](#whats-intentionally-not-in-phase-2).

## Tech stack

| Layer      | Stack                                                                            |
| ---------- | --------------------------------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion, Zustand, React Hook Form, Zod, react-markdown |
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

## What's in Phase 1

Landing page, Clerk authentication, a dashboard with sidebar navigation, project CRUD (create,
edit, archive, duplicate, delete) with search/filter/pagination, project templates, a profile page,
a settings page (theme, notifications, security via Clerk, account deletion), and a billing page
showing plan/usage.

## What's in Phase 2

A per-project AI chat: create/rename/delete conversations, send a message and watch the AI's reply
stream in token-by-token, stop an in-flight generation, retry a failed reply, Markdown + syntax
highlighting in assistant messages, and full conversation history that survives a refresh. The AI
is given the project's stored tech stack as context and answers specifically for it. Full details
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/API.md](docs/API.md).

## What's intentionally not in Phase 2

The AI chat is **chat-only** — it cannot read, write, or execute anything in a project, and never
claims to. Also out of scope: an in-browser IDE, a terminal, Docker, code generation, live preview,
GitHub integration, and a real deployment engine. The `Deployment` model and `/deployments` page
exist as placeholders for a future phase. Anthropic/Gemini providers are structurally supported
(swap `AI_PROVIDER`) but not implemented — only OpenAI works today.
