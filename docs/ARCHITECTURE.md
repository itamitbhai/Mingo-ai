# Architecture

## Monorepo

npm workspaces tie together three packages:

- **`shared`** — enums, TypeScript interfaces, and Zod schemas used by both the client and the
  server, so validation rules and types are defined exactly once. It's compiled to `shared/dist`
  (CommonJS + `.d.ts`) and consumed like any other npm dependency — run
  `npm run build --workspace=shared` after changing it (or `npm run dev --workspace=shared` to
  watch).
- **`server`** — an Express + TypeScript API, described below.
- **`client`** — a Next.js 15 App Router frontend, described below.

## Server (`server/`)

Layered structure:

```
src/
├── config/       env loading & validation (Zod), MongoDB connection, workspace limits
│                 (workspace.config.ts)
├── models/       Mongoose schemas: User, Project, Workspace (a vestigial Phase-1 org/team
│                 concept — not the file-tree workspace), Settings, Activity, Deployment,
│                 Conversation, Message, Usage, ProjectFile, ProjectWorkspace,
│                 ProjectFileVersion, WorkspaceSnapshot, WorkspaceActivity, WorkspaceLock
├── middlewares/  auth (Clerk), centralized error handling, rate limiting (express-rate-limit for
│                 general routes, a custom in-memory abstraction for AI requests), request validation
├── validators/   re-exports of the shared Zod schemas, wired into routes via the validate middleware
├── controllers/  thin request/response handlers
├── services/     business logic (the controllers call these; this is where DB queries live)
│   ├── ai/         provider-agnostic AI layer (see "AI chat" below)
│   ├── files/       the base MongoDB-backed "filesystem" CRUD (see "Workspace Engine" below)
│   ├── templates/   technology-aware starter-file templates, one per stack
│   └── workspace/   versioning, snapshots, batch/preview, locking, caching, the virtual
│                     filesystem facade (see "Workspace Engine" below)
├── routes/       Express routers, one per resource
└── utils/        ApiError, ApiResponse helpers, asyncHandler, logger, checksum, withTransaction
```

Request flow: `route → requireAuth → loadUser → validate(schema) → controller → service → model`.

- **Auth**: `@clerk/express`'s `clerkMiddleware()` runs globally and reads the caller's Clerk
  session from the `Authorization: Bearer <token>` header (the client attaches this on every
  request). `requireAuth` rejects unauthenticated requests; `loadUser` resolves the Clerk identity
  to a local `User` document, upserting it on first sight, so the rest of the app only ever deals
  with our own `User` model.
- **Clerk → MongoDB sync**: `POST /api/webhooks/clerk` verifies Clerk's webhook signature (via
  `svix`) and upserts/deletes the local `User` document on `user.created` / `user.updated` /
  `user.deleted`. `loadUser`'s just-in-time creation is a fallback for local development when the
  webhook isn't configured yet — in production, the webhook is the source of truth.
- **Errors**: every thrown `ApiError` (or Zod/Mongoose validation error) is caught by a single
  `errorHandler` middleware and turned into a consistent `{ success: false, message, errors? }`
  JSON shape.
- **`toJSON` transform**: every model normalizes its serialized shape to match the `shared`
  TypeScript interfaces exactly — `_id` becomes `id`, `__v` is stripped. This is what lets the
  client deserialize API responses directly into `shared`'s types with no manual mapping.

## AI chat (`server/src/services/ai/`)

```
services/ai/
├── ai.service.ts          orchestrates one turn: builds the system prompt + history window,
│                          picks a provider by AI_PROVIDER, normalizes provider errors
├── ai.types.ts             the provider boundary: ChatMessage, StreamChunk, AIProviderAdapter,
│                          AIProviderError — providers only ever speak this shape
├── providers/
│   └── openai.provider.ts the only implemented provider today; wraps the `openai` SDK's
│                          streaming chat completions and maps its errors onto AIProviderError
└── prompts/
    └── system.prompt.ts   builds the "Mingo AI — Senior Software Engineer" system prompt from a
                           project's stored tech stack
```

Adding a second provider (Anthropic, Gemini, a local model) means implementing
`AIProviderAdapter` in a new file under `providers/` and registering it in `ai.service.ts`'s
provider map — nothing in the controller, routes, or frontend changes.

**Streaming a message** (`POST /api/conversations/:conversationId/messages`, in
`message.controller.ts`):

1. Persist the user's message (or, for a retry, reset the existing failed assistant message in
   place instead of creating a new one).
2. Set `Content-Type: text/event-stream` and flush headers immediately.
3. Build a bounded history window (last `HISTORY_WINDOW` messages, excluding failed/cancelled
   ones) plus the project's tech stack as a `ProjectContext`, and call `ai.service.generateReply`.
4. For each chunk from the provider: write an SSE `delta` frame to the client and periodically
   (throttled, not per-token) persist the accumulated content so a mid-stream refresh still shows
   something.
5. On completion: mark the message `completed`, store token usage in the `Usage` collection, send
   a final `done` frame. On a provider error: mark `failed`, send an `error` frame with a friendly
   message (the raw error is logged server-side only). On client disconnect (the client aborted its
   `fetch` to implement "Stop generating"): `res.on('close')` fires, aborts the same
   `AbortSignal` passed into the provider call, and marks the message `cancelled`.

Because SSE responses must not be gzip-buffered by `compression()`, `app.ts` passes a `filter` that
excludes `POST .../messages` from compression.

## Workspace Engine (`server/src/services/files/`, `services/templates/`, `services/workspace/`)

**MongoDB is the only filesystem** — `ProjectFile` documents (`path`, `parentPath`, `type`,
`content`, `checksum`, `version`, ...) are the entire directory tree; there is no real disk I/O
anywhere in this API, and project files never touch the server's OS filesystem. `assertSafePath`
(`services/files/file-validation.service.ts`) runs on every path even though the Zod route schema
(`shared`'s `relativePathSchema`) already normalized/validated it — defense in depth, since this
function is the only thing standing between a crafted `path` and an out-of-scope query. Every query
is additionally scoped to `{ project, owner }`, matching `project.service`'s existing ownership
pattern (never trusting a client-supplied owner id) — this is also what makes cross-project and
cross-user access structurally impossible, not just checked.

```
services/files/
├── file-validation.service.ts  assertSafePath, getParentPath/getBaseName/escapeRegExp
├── file.service.ts              CRUD: getFileContent, createFile, createFolder, updateFileContent,
│                                renameEntry, deleteEntry, searchFiles — see below, this is also
│                                where every mutation gets versioned/checksummed/activity-logged
└── file-tree.service.ts         builds the nested, folders-first-then-alphabetical tree

services/templates/
├── template.service.ts          createStarterFiles(project, owner, frontend, backend) — combines
│                                a frontend template + an (optional) backend template
└── templates/                   one file per stack: react/nextjs/vue.template.ts (frontend),
                                 node/express.template.ts (backend) — only ever seeds a small
                                 starter tree, never a complete application

services/workspace/
├── path.service.ts               re-exports file-validation's helpers + assertValidMove (rejects
│                                 moving a folder into itself or its own descendant)
├── version.service.ts            recordVersion/listVersions/getVersion against ProjectFileVersion
├── workspace-activity.service.ts logActivity/listActivity against WorkspaceActivity (distinct from
│                                 the top-level project-activity log — this one is file/folder ops)
├── workspace.service.ts          ensureWorkspace (get-or-create ProjectWorkspace), getManifest
│                                 (framework/language/entry points/package.json, computed live —
│                                 never fabricated)
├── move.service.ts               moveOrRenameEntry (the cascade logic, shared with file.service's
│                                 renameEntry) + moveEntry (arbitrary destination)
├── cache.service.ts              WorkspaceCache — in-memory get/set/invalidate/clear behind an
│                                 interface a Redis implementation could satisfy later
├── snapshot.service.ts           createSnapshot/listSnapshots/restoreSnapshot
├── lock.service.ts               acquireLock/releaseLock/isLocked/refreshLock — a TTL-expiring
│                                 foundation for future agents, not enforced on writes yet
├── preview.service.ts            planOperations (shared by preview and batch) + previewOperations
├── batch.service.ts               applyBatch — validates the whole batch before writing anything
└── virtual-file-system.service.ts the single agent-ready facade (see below)
```

**Every mutation is versioned and logged, on both the old and new endpoints.** `file.service.ts`'s
`createFile`/`createFolder`/`updateFileContent`/`renameEntry`/`deleteEntry` — the same functions the
Phase 3 `/files` and `/folders` endpoints have always called — now also compute a SHA-256 checksum,
append a `ProjectFileVersion` history entry, log a `WorkspaceActivity` entry, invalidate the
project's cache, and bump the `ProjectWorkspace.activeVersion` counter. There is one filesystem
implementation, not a parallel "real" one and a "versioned" one; the live Monaco IDE gets real
history for free.

**Renaming/moving a folder** doesn't cascade via a database trigger — `moveOrRenameEntry`
(`services/workspace/move.service.ts`) finds every `ProjectFile` whose `path` equals or is prefixed
by the folder's path, then rewrites them in a single `bulkWrite`. `file.service.ts`'s `renameEntry`
(same-parent name change) and `move.service.ts`'s `moveEntry` (arbitrary destination) both delegate
to this one function.

**Version conflicts**: every `ProjectFile` has a `version` counter, incremented on each content
save (skipped entirely when the new checksum matches the stored one — spec: "prevent unnecessary
saves"). The client always sends back the `version` it loaded as `expectedVersion`; a mismatch means
someone/something else saved first, and the update is rejected with `409` rather than silently
overwriting newer content (see `docs/API.md`). The client's "Reload" toast action
(`use-file-tab.ts`'s `reloadFileFromServer`) discards the local edit and re-fetches.

**Snapshots** (`snapshot.service.ts`) don't copy file content — a `WorkspaceSnapshot` stores an
`entries: [{ file, path, type, version, checksum }]` array that references existing
`ProjectFileVersion` documents, so creating one is cheap regardless of file count. Restoring
(`restoreSnapshot`) always creates an automatic backup snapshot of the *current* state first, then
restores each entry from its referenced version (recreating deleted files, rewriting changed ones)
and removes anything created since the snapshot — wrapped in `withTransaction`
(`utils/withTransaction.ts`), which uses a real MongoDB session/transaction when the server supports
one (e.g. Atlas) and falls back to sequential, non-atomic execution on a standalone dev server.

**Batch operations** (`batch.service.ts`, `preview.service.ts`) share one `planOperations` function:
given a list of create/update/delete/rename/move operations, it validates every one against the
project's *current* state (path safety, size limits, conflicts, duplicate targets within the same
batch) and auto-synthesizes CREATE-folder entries for any missing ancestor directories, so a caller
can create `src/auth/auth.service.ts` without first creating `src/auth`. `previewOperations` runs
this with no writes (`POST .../preview`); `applyBatch` (`POST .../batch`) rejects the whole batch if
validation finds any error or conflict, then applies every entry through the same
`file.service`/`move.service` functions everything else uses (so batched changes get the same
version/activity history). Full session-threaded atomicity across every applied operation is left
for a future phase — the exhaustive up-front validation is what makes a partial application
unlikely in practice today.

**The virtual filesystem facade** (`virtual-file-system.service.ts`) is what future AI agents (the
planner, frontend/backend/database agents, code generation) will call —
`readFile`/`writeFile`/`createFile`/`deleteFile`/`move`/`listFiles`/`search`/`getWorkspaceSnapshot`
— composing the services above. Agents never touch `ProjectFileModel`/MongoDB or the real OS
filesystem directly.

**Locking** (`lock.service.ts`) is a real, tested, TTL-expiring primitive
(`acquireLock`/`releaseLock`/`isLocked`/`refreshLock` against `WorkspaceLock`, with a Mongo TTL
index so a lock can never go stale permanently) — it is intentionally *not* enforced on any write
path yet. It exists as the foundation a future concurrency/multi-agent layer builds on, not a
concurrency system shipping in this phase.

## Planner Agent (`server/src/agents/`)

The first real AI *agent* in Mingo AI — turns a natural-language request into a structured,
validated `ProjectPlan` (requirements, stack, architecture, features, database, APIs, file
structure, a dependency-ordered task graph). It never writes files, runs commands, or touches
MongoDB directly; it's pure orchestration over the existing `ai.service` from the "AI chat"
section above.

```
agents/
├── context/
│   ├── project-context.service.ts   thin loaders over project.service/workspace.service/
│   │                                fileTreeService/workspace-activity.service/message.service
│   └── project-context.builder.ts   composes them into one PlannerContext
└── planner/
    ├── planner.types.ts              PlannerContext, PlannerStage, stage-event types
    ├── planner.schema.ts             the Zod schema for the AI's JSON output
    ├── planner.prompts.ts            system/user/correction prompt builders
    ├── planner.validator.ts          JSON parse + Zod validation + semantic checks (duplicate/
    │                                unknown task ids, circular dependencies, execution-order
    │                                consistency)
    ├── planner.agent.ts              runPlannerAgent — the retry loop (bounded by
    │                                MAX_PLANNER_RETRIES) that ties prompts+AI+validation together
    └── planner.service.ts            persistence: versioning, diffing, status transitions, field
                                      edits, deletion guards — the only layer that touches
                                      ProjectPlanModel
```

**Context first, then a single structured completion.** `buildPlannerContext` composes the
project's tech stack, its Phase 4 workspace manifest, a metadata-only file list (paths only, never
content), recent workspace activity, and (if a conversation id is given) the last ~10 non-failed
chat messages — mirroring the same "metadata first" discipline the Workspace Engine already
follows. `planner.agent.ts` then makes **one non-streamed, JSON-mode** completion via a new
`ai.service.generateStructuredCompletion` (backed by a `complete()` method added to
`AIProviderAdapter`/`openaiProvider`, using OpenAI's `response_format: {type:'json_object'}`) —
deliberately not a token stream, since a single reliable JSON blob is what a structured plan needs,
not incremental text.

**Validation and retry** (`planner.validator.ts` + `planner.agent.ts`): every response goes through
JSON parsing → Zod structural validation (`planOutputSchema`) → semantic checks (no duplicate or
unknown task ids, no circular task dependencies via a DFS cycle detector, and `executionOrder` must
be a full permutation that respects every dependency). Any failure feeds a correction prompt
(quoting the previous invalid output and the specific issues found) back to the model, up to
`MAX_PLANNER_RETRIES` additional attempts. If every attempt fails, a `status: 'failed'`
`ProjectPlan` is still persisted (prompt + a friendly `error` message, no partial structured
content) so the failure stays auditable — nothing is silently dropped.

**Streaming progress is honest about what's real.** `plan.controller.ts`'s `generatePlan`/
`regeneratePlan` reuse the exact SSE wire format `message.controller.ts` already established
(`text/event-stream`, `data: <json>\n\n` frames, abort-on-client-disconnect) but emit `stage`
events (`loading_context` → `generating` → `validating` → `retrying`? → `saving` → `done`/`error`)
instead of text deltas. Since the AI call itself is one opaque request, the client additionally
cycles the spec's descriptive sub-labels ("Understanding requirements…", "Analyzing technology
stack…", …) as an indeterminate-progress animation while the server's `generating` stage is
active — narration for the user, not a claim of discrete backend completions that don't exist.

**Versioning**: every generation (initial or regenerated) creates a new `ProjectPlan` document with
`version = (latest existing version for the project) + 1` — history is never overwritten.
`regeneratePlan` reuses the anchor plan's original prompt unless a new one is given, then computes
a plain structural diff (`diffPlans`: added/removed/changed features and tasks by id, changed stack
entries by category) — not a text/line diff.

**Editing is scoped, not freeform.** `PATCH /plans/:planId` only accepts small, id-targeted edits
(a feature's title/description/priority, a task's title/description/acceptance criteria), merged
into the stored arrays by `planner.service.updatePlanFields` — never a wholesale array replacement
— and the whole edited plan is re-validated against `planOutputSchema` before saving.

**`ProjectPlan`'s plan body is stored as `Schema.Types.Mixed`**, not hand-built Mongoose
sub-schemas — it mirrors 15+ nested shapes and is always read/written as one unit, never queried by
sub-field. Zod is the real structural gatekeeper, validated before every save; a parallel Mongoose
schema would just duplicate it.

**Usage tracking**: `usage.service.recordUsage` (originally chat-only) now takes an optional
`conversation` and a `purpose: 'chat' | 'planner'` field — every planner attempt (successful or
exhausted) records real token counts from the OpenAI response, tagged `purpose: 'planner'`.

## Client (`client/`)

```
src/
├── app/               App Router routes, grouped by chrome:
│   ├── (marketing)/     landing page, privacy, terms — has its own Navbar+Footer layout
│   ├── (auth)/           sign-in / sign-up — centered layout, protected by nothing (public)
│   └── (dashboard)/      dashboard, projects, templates, deployments, billing, settings, profile
│                         — sidebar + topbar layout, protected by middleware.ts
│       ├── projects/[id]/chat/[[conversationId]]  AI chat — see below
│       └── projects/[id]/workspace                browser IDE — see below
├── components/ui/     shadcn/ui-style primitives (button, card, dialog, select, chart,
│                       resizable, command, context-menu, ...)
├── components/shared/ small app-wide components (Logo, EmptyState, PaginationControls, ...)
├── components/chat/    AI chat UI (ChatShell, ChatSidebar, ChatMessages, ChatComposer, ...)
├── components/workspace/ browser IDE UI (WorkspaceShell, FileExplorer, MonacoEditorPane,
│                         EditorTabs, CommandPalette, WorkspaceChatPanel, BottomPanel, ...) plus
│                         the Phase 4 workspace-engine UI (SnapshotPanel, HistoryPanel,
│                         DiffViewerDialog, BatchOperationsDialog, MoveEntryDialog,
│                         WorkspaceStatusBadge)
├── features/          feature-scoped components, grouped by domain (projects, dashboard, ...)
├── services/           thin wrappers around `fetch` for each API resource (`services/files/` for
│                       base file CRUD, `services/workspace/` for the workspace engine — manifest,
│                       activity, snapshots, versions, batch/preview, move)
├── store/              Zustand stores for client-only UI state: modal open/close, the chat mobile
│                       drawer + pending-first-message handoff, and the workspace's UI state
│                       (`use-workspace-ui-store.ts`, persisted) + file content cache
│                       (`use-file-cache-store.ts`, not persisted) + server-derived workspace state
│                       (`use-workspace-store.ts`, not persisted — manifest/snapshots/activity/
│                       pending batch preview) — see below
├── providers/          Theme, Clerk, and Sonner (toast) providers, composed in the root layout
├── lib/                `cn`, the API fetch helper, constants, server-only auth helpers,
│                       `format-document.ts` (Prettier standalone)
├── hooks/              `useDebouncedValue`, `useProjectActions`, `useConversations`, `useChat`,
│                       `useWorkspaceFiles`, `useFileTab`, `useWorkspaceKeyboardShortcuts`
├── types/               types for API shapes that are specific to the client (not shared)
└── utils/               formatting helpers (dates, initials, tech-stack badges, file icons)
```

- **Data fetching**: dashboard pages are Server Components. They call `getServerAuthToken()`
  (wraps `@clerk/nextjs/server`'s `auth()`) and pass the token to a `services/*.ts` function, which
  hits the Express API. Read functions are wrapped in React's `cache()` so a token/profile fetch
  used by both a layout and its page only hits the API once per request.
- **Mutations**: Client Components (forms, dropdown actions) call the same `services/*.ts`
  functions directly with a token from `useAuth().getToken()`, then call `router.refresh()` so the
  Server Components above them re-fetch fresh data — no separate client-side cache to keep in
  sync.
- **Zustand**: used only for state that has no server counterpart — whether the create/edit
  project modal is open, and what it should be pre-filled with (used by the "Use this template"
  flow on the Templates page).
- **Middleware**: `middleware.ts` uses `clerkMiddleware()` + `createRouteMatcher()` to require a
  signed-in session for every dashboard route; everything else is public.

### AI chat

The active conversation lives in the URL (`/projects/[id]/chat/[conversationId]`), not just client
state — that's what makes "refresh without losing the conversation" work for free via SSR, the same
way `projects/[id]/page.tsx` server-fetches a project. `/projects/[id]/chat` (no id) redirects to
the most-recently-updated conversation, or renders the empty state if none exist yet.

`ChatShell` (client) owns `useConversations` (the sidebar list) and renders either
`ConversationView` (owns `useChat`: messages, streaming state, send/retry/stop) or
`NewConversationView` (create-a-conversation-then-redirect) for the main pane — conditionally
rendering a different child component, not conditionally calling hooks. `useChat`'s
`chatService.streamMessage` reads the backend's SSE frames via `fetch` + `ReadableStream` (see
`docs/API.md`), not the browser `EventSource` API, since the request needs an `Authorization`
header. "Stop generating" is a plain `AbortController.abort()` on that fetch.

Assistant messages render through `MarkdownRenderer` (`react-markdown` + `remark-gfm` +
`rehype-highlight`) with a custom code-block renderer for the language label and copy button.

### Workspace (browser IDE)

`WorkspaceShell` composes the whole layout with shadcn's `resizable.tsx`
(`react-resizable-panels`): a horizontal group for Explorer / Editor / AI chat, nested inside a
vertical group with the bottom Output/Problems/Logs/Terminal panel. It owns the one `useFileTab`
call for whichever tab is active (Monaco only ever shows one file at a time) and reads/writes two
Zustand stores:

- `use-workspace-ui-store.ts` (persisted to `localStorage`, keyed per project id) — open tab paths,
  active tab, expanded folders, panel visibility, editor preferences. Explicitly `partialize`d to
  exclude file content, per the "no sensitive data in localStorage" rule — only UI preferences
  persist, and reopened tabs re-fetch their content fresh from MongoDB on reload.
- `use-file-cache-store.ts` (in-memory only, never persisted) — the actual content/dirty/version
  state for whichever files are currently open, keyed by `${projectId}:${path}`.

**Editor**: `MonacoEditorPane` wraps `@monaco-editor/react` (Monaco itself loads from a CDN, its
default) and defines a custom `mingo-dark` theme via `monaco.editor.defineTheme` rather than using
VS Code's default. Selecting text and choosing "Ask Mingo AI" from Monaco's own context menu (added
via `editor.addAction`) attaches that selection to the AI panel — it never edits the buffer.

**Save/autosave**: `useFileTab` debounces autosave (1.5s after the user stops typing, only when
content actually changed) and calls the same `updateFileContent` service the manual Ctrl+S path
uses, passing the loaded `version` as `expectedVersion` so a stale save is rejected with a friendly
conflict message instead of silently overwriting newer content.

**AI panel**: `WorkspaceChatPanel` reuses Phase 2's `useChat`/`useConversations` hooks and
`ChatMessages`/`ChatComposer`/`MarkdownRenderer` components directly — it does **not** reuse
`ChatShell`, because `ChatShell` hard-codes a `md:` viewport breakpoint to show/hide its 288px
conversation sidebar, which is correct for a full page but wrong inside a ~360px docked panel. The
"current file" / "selected code" context is pure client-side string composition (a fenced code
block prepended to the message) before calling the existing `chat.service.streamMessage` — zero
Phase 2 API changes.

**Formatting**: "Format Document" runs Prettier's browser ("standalone") build entirely
client-side, dynamically importing only the plugin(s) needed for the current file's language.

**Workspace engine UI (Phase 4)**: the header's "Workspace" menu opens `SnapshotPanel` (list/create/
restore, with an explicit "current workspace will be backed up automatically" confirmation before
any restore) and `HistoryPanel` (cursor-paginated activity feed grouped into Today/Yesterday/older),
both `Sheet` side panels backed by `use-workspace-store.ts`. `BatchOperationsDialog` is the manual
entry point for the preview → apply flow (spec §41) — AI-generated operations will drive the same
dialog in a future phase. `DiffViewerDialog` wraps `@monaco-editor/react`'s `DiffEditor` for
version/snapshot comparison, under its own Monaco theme id (`mingo-dark-diff`) so it can't silently
overwrite the main editor's `mingo-dark` theme — Monaco's theme registry is global across every
editor instance on the page. A save conflict's toast now has a "Reload" action
(`reloadFileFromServer` in `use-file-tab.ts`) that discards the local edit and re-fetches. Binary
files (detected server-side by extension/MIME type) show "Binary file preview is not available."
in `MonacoEditorPane` instead of loading their content into the text editor.

### Planner

`/projects/[id]/plan` (`PlannerWorkspace`) owns `use-planner-store.ts` (non-persisted: run status,
current stage/label, the current/latest plan, a page of version history, a pending regeneration
diff) and streams via `services/planner/planner.service.ts`'s `streamPlanGeneration`/
`streamRegeneratePlan` — the exact same `fetch` + `ReadableStream` + `AbortController` pattern
`chat.service.ts` uses, over `stage`/`done`/`error` frames instead of text deltas.
`PlannerPromptForm` cycles the descriptive sub-labels client-side while the server's `generating`
stage is active (see the "Planner Agent" section above for why). `PlanView` renders the plan's
sections — requirements/stack/architecture/features/database/API/file structure/tasks/risks — as
tabs; architecture nodes/edges and the task graph are rendered as connector-styled lists rather
than a React Flow canvas (not installed, and the spec itself treats it as optional). Editing a
feature or task opens a small dialog and calls `PATCH /plans/:planId` with just that one field
change. Entry points: a "Plan with Mingo" item in the Workspace IDE's header dropdown, and an "Open
Planner" button on the project detail page, alongside the existing Workspace/Chat buttons.

## Design system

Tailwind v4 (CSS-first config, no `tailwind.config.ts`) with an OKLCH color palette defined in
`app/globals.css`, exposed as shadcn-style CSS variables (`--background`, `--primary`, etc.) and a
handful of custom utilities (`glass`, `glass-card`, `gradient-text`, `gradient-bg`, `glow-primary`)
for the glassmorphism/gradient look. Dark mode is the default theme, toggled via `next-themes`. The
Monaco editor has its own separate `mingo-dark` theme (see "Workspace" above), since Monaco doesn't
use CSS variables/Tailwind.
