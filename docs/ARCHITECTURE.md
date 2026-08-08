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
│                 Conversation, Message, Usage
├── middlewares/  auth (Clerk), centralized error handling, rate limiting (express-rate-limit for
│                 general routes, a custom in-memory abstraction for AI requests), request validation
├── validators/   re-exports of the shared Zod schemas, wired into routes via the validate middleware
├── controllers/  thin request/response handlers
├── services/     business logic (the controllers call these; this is where DB queries live)
│   └── ai/       provider-agnostic AI layer (see "AI chat" below)
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

## Client (`client/`)

```
src/
├── app/               App Router routes, grouped by chrome:
│   ├── (marketing)/     landing page, privacy, terms — has its own Navbar+Footer layout
│   ├── (auth)/           sign-in / sign-up — centered layout, protected by nothing (public)
│   └── (dashboard)/      dashboard, projects, templates, deployments, billing, settings, profile
│                         — sidebar + topbar layout, protected by middleware.ts
│       └── projects/[id]/chat/[[conversationId]]  AI chat — see below
├── components/ui/     shadcn/ui-style primitives (button, card, dialog, select, chart, ...)
├── components/shared/ small app-wide components (Logo, EmptyState, PaginationControls, ...)
├── components/chat/    AI chat UI (ChatShell, ChatSidebar, ChatMessages, ChatComposer, ...)
├── features/          feature-scoped components, grouped by domain (projects, dashboard, ...)
├── services/           thin wrappers around `fetch` for each API resource
├── store/              Zustand stores for client-only UI state (modal open/close state, the chat
│                       mobile drawer, and the pending-first-message handoff — see below)
├── providers/          Theme, Clerk, and Sonner (toast) providers, composed in the root layout
├── lib/                `cn`, the API fetch helper, constants, server-only auth helpers
├── hooks/              `useDebouncedValue`, `useProjectActions`, `useConversations`, `useChat`
├── types/               types for API shapes that are specific to the client (not shared)
└── utils/               formatting helpers (dates, initials, tech-stack badges)
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

## Design system

Tailwind v4 (CSS-first config, no `tailwind.config.ts`) with an OKLCH color palette defined in
`app/globals.css`, exposed as shadcn-style CSS variables (`--background`, `--primary`, etc.) and a
handful of custom utilities (`glass`, `glass-card`, `gradient-text`, `gradient-bg`, `glow-primary`)
for the glassmorphism/gradient look. Dark mode is the default theme, toggled via `next-themes`.
