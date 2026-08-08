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
├── config/       env loading & validation (Zod), MongoDB connection
├── models/       Mongoose schemas: User, Project, Workspace, Settings, Activity, Deployment,
│                 Conversation, Message, Usage, ProjectFile
├── middlewares/  auth (Clerk), centralized error handling, rate limiting (express-rate-limit for
│                 general routes, a custom in-memory abstraction for AI requests), request validation
├── validators/   re-exports of the shared Zod schemas, wired into routes via the validate middleware
├── controllers/  thin request/response handlers
├── services/     business logic (the controllers call these; this is where DB queries live)
│   ├── ai/       provider-agnostic AI layer (see "AI chat" below)
│   └── files/    the workspace's MongoDB-backed "filesystem" (see "Workspace" below)
├── routes/       Express routers, one per resource
└── utils/        ApiError, ApiResponse helpers, asyncHandler, logger
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

## Workspace (`server/src/services/files/`)

```
services/files/
├── file-validation.service.ts  assertSafePath (rejects `..`, absolute paths, drive letters, null
│                                bytes), plus getParentPath/getBaseName/escapeRegExp helpers
├── file.service.ts              CRUD: getFileContent, createFile, createFolder, updateFileContent
│                                (optimistic-concurrency version check), renameEntry (cascades to
│                                every descendant for a folder), deleteEntry (cascades), searchFiles
├── file-tree.service.ts         builds the nested, folders-first-then-alphabetical tree the
│                                explorer renders, from the flat ProjectFile collection
└── starter-files.service.ts     seeds a small stack-aware starter tree when a project is created
```

**MongoDB is the only filesystem** — `ProjectFile` documents (`path`, `parentPath`, `type`,
`content`, `version`, ...) are the entire directory tree; there is no real disk I/O anywhere in this
API. `assertSafePath` runs on every path even though the Zod route schema (`shared`'s
`relativePathSchema`) already normalized/validated it — defense in depth, since this function is the
only thing standing between a crafted `path` and an out-of-scope query. Every query is additionally
scoped to `{ project, owner }`, matching `project.service`'s existing ownership pattern (never
trusting a client-supplied owner id).

**Renaming/deleting a folder** doesn't cascade via a database trigger — `renameEntry`/`deleteEntry`
find every `ProjectFile` whose `path` equals or is prefixed by the folder's path, then rewrite them
in a single `bulkWrite` (rename) or remove them in one `deleteMany` (delete).

**Version conflicts**: every `ProjectFile` has a `version` counter, incremented on each content
save. The client always sends back the `version` it loaded as `expectedVersion`; a mismatch means
someone/something else saved first, and the update is rejected with `409` rather than silently
overwriting newer content (see `docs/API.md`).

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
│                         EditorTabs, CommandPalette, WorkspaceChatPanel, BottomPanel, ...)
├── features/          feature-scoped components, grouped by domain (projects, dashboard, ...)
├── services/           thin wrappers around `fetch` for each API resource (`services/files/` for
│                       the workspace)
├── store/              Zustand stores for client-only UI state: modal open/close, the chat mobile
│                       drawer + pending-first-message handoff, and the workspace's UI state
│                       (`use-workspace-ui-store.ts`, persisted) + file content cache
│                       (`use-file-cache-store.ts`, not persisted) — see below
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

## Design system

Tailwind v4 (CSS-first config, no `tailwind.config.ts`) with an OKLCH color palette defined in
`app/globals.css`, exposed as shadcn-style CSS variables (`--background`, `--primary`, etc.) and a
handful of custom utilities (`glass`, `glass-card`, `gradient-text`, `gradient-bg`, `glow-primary`)
for the glassmorphism/gradient look. Dark mode is the default theme, toggled via `next-themes`. The
Monaco editor has its own separate `mingo-dark` theme (see "Workspace" above), since Monaco doesn't
use CSS variables/Tailwind.
