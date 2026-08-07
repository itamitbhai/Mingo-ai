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
├── models/       Mongoose schemas: User, Project, Workspace, Settings, Activity, Deployment
├── middlewares/  auth (Clerk), centralized error handling, rate limiting, request validation
├── validators/   re-exports of the shared Zod schemas, wired into routes via the validate middleware
├── controllers/  thin request/response handlers
├── services/     business logic (the controllers call these; this is where DB queries live)
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

## Client (`client/`)

```
src/
├── app/               App Router routes, grouped by chrome:
│   ├── (marketing)/     landing page, privacy, terms — has its own Navbar+Footer layout
│   ├── (auth)/           sign-in / sign-up — centered layout, protected by nothing (public)
│   └── (dashboard)/      dashboard, projects, templates, deployments, billing, settings, profile
│                         — sidebar + topbar layout, protected by middleware.ts
├── components/ui/     shadcn/ui-style primitives (button, card, dialog, select, chart, ...)
├── components/shared/ small app-wide components (Logo, EmptyState, PaginationControls, ...)
├── features/          feature-scoped components, grouped by domain (projects, dashboard, ...)
├── services/           thin wrappers around `fetch` for each API resource
├── store/              Zustand stores for client-only UI state (modal open/close state)
├── providers/          Theme, Clerk, and Sonner (toast) providers, composed in the root layout
├── lib/                `cn`, the API fetch helper, constants, server-only auth helpers
├── hooks/              `useDebouncedValue`, `useProjectActions`
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

## Design system

Tailwind v4 (CSS-first config, no `tailwind.config.ts`) with an OKLCH color palette defined in
`app/globals.css`, exposed as shadcn-style CSS variables (`--background`, `--primary`, etc.) and a
handful of custom utilities (`glass`, `glass-card`, `gradient-text`, `gradient-bg`, `glow-primary`)
for the glassmorphism/gradient look. Dark mode is the default theme, toggled via `next-themes`.
