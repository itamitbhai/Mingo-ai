# Local setup guide

## 1. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Under **Database Access**, create a user with a password.
3. Under **Network Access**, allow your current IP (or `0.0.0.0/0` for local development only).
4. Click **Connect → Drivers**, copy the connection string, and swap in your username/password —
   this is your `MONGODB_URI`.

## 2. Clerk

1. Create an application at [clerk.com](https://clerk.com).
2. Enable **Email**, **Google**, and **GitHub** under **User & Authentication → Social
   Connections** (email/password + forgot-password work out of the box).
3. Copy the **Publishable key** and **Secret key** from **API Keys**.
4. Under **Webhooks**, add an endpoint pointing at your server's
   `/api/webhooks/clerk` (for local development, use a tunnel like `ngrok http 8080` and point the
   webhook at `https://<ngrok-subdomain>/api/webhooks/clerk`). Subscribe to `user.created`,
   `user.updated`, and `user.deleted`. Copy the **Signing Secret**.
   - Skipping this step is fine for local development — `loadUser` middleware creates the local
     user record on first API call regardless. The webhook is what keeps things in sync in
     production and when a user updates their name/avatar in Clerk directly.

## 3. OpenAI (for the AI chat)

1. Create an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. That's it — no other setup. The model is configurable via `AI_MODEL` (defaults to
   `gpt-4o-mini`).

Without this, every other Phase 1 feature (projects, dashboard, settings) still works — only the
AI chat endpoint will return a friendly "not configured" error until a key is set.

## 4. GitHub OAuth App (Phase 12 — GitHub integration)

A standalone GitHub OAuth App, independent of Clerk login — Clerk authenticates *into* Mingo; this
authorizes Mingo's backend to call the GitHub API on the user's behalf.

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps**
   → **New OAuth App**.
2. **Homepage URL**: `http://localhost:3001` (or wherever the client runs).
3. **Authorization callback URL**: `http://localhost:8080/api/github/callback` — must match
   `GITHUB_CALLBACK_URL` exactly.
4. Copy the **Client ID**, and generate + copy a **Client secret**.
5. Requested scopes are set at authorize time, not on the app itself: `repo`, `read:user`,
   `user:email`.
6. Generate a local encryption key for storing tokens at rest: `openssl rand -base64 32` (or
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

Without this, every other feature still works — GitHub-dependent routes return a clear
"not configured"/"connect your GitHub account" error instead.

## 5. Render (Phase 13 — deployments)

The first real deployment provider; Vercel/Railway are wired into the same provider interface but
not yet implemented (they return a clear "not configured" error rather than a fake success).

1. Get an API key from [dashboard.render.com/u/settings#api-keys](https://dashboard.render.com/u/settings#api-keys).
2. That's the whole setup — Mingo resolves your Render workspace (`ownerId`) automatically from the
   key.
3. **Known limitation**: Render's API can only deploy a *public* GitHub repository directly, or a
   private one you've already connected via Render's own dashboard/GitHub App install — Mingo
   cannot grant Render access to a private repo on your behalf.
4. Optional — for `push`/`pull_request` webhook-triggered auto-deploys and PR previews: create a
   webhook on the connected repository (**Settings → Webhooks → Add webhook**), payload URL
   `https://<your-public-host>/api/webhooks/github`, content type `application/json`, and set a
   secret (`GITHUB_WEBHOOK_SECRET` must match it exactly). GitHub can't reach `localhost` directly —
   use a tunnel (e.g. `ngrok http 8080`) for local testing.

Without this, every other feature still works — triggering a deployment returns a clear
"provider not configured" error instead.

## 6. Environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

Fill in:

**`server/.env`**

- `MONGODB_URI` — from step 1
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` — from step 2
- `CLERK_WEBHOOK_SECRET` — from step 2 (or leave the placeholder if you skipped the webhook)
- `CLIENT_URL` — `http://localhost:3000` for local dev
- `OPENAI_API_KEY` — from step 3 (leave blank to run everything except AI chat)
- `WORKSPACE_MAX_FILE_SIZE_BYTES`, `WORKSPACE_MAX_BATCH_OPERATIONS`, `WORKSPACE_MAX_PROJECT_FILES`,
  `WORKSPACE_MAX_PATH_LENGTH`, `WORKSPACE_LOCK_TTL_MS`, `WORKSPACE_CACHE_TTL_MS` — all optional,
  every workspace-engine limit has a sensible default (see `server/src/config/workspace.config.ts`)
- `MAX_PLANNER_RETRIES`, `PLANNER_RATE_LIMIT_WINDOW_MS`, `PLANNER_RATE_LIMIT_MAX_REQUESTS` — all
  optional, control the Planner Agent's correction-prompt retry budget and its (separate, stricter)
  rate limit; same `OPENAI_API_KEY` from step 3 powers plan generation
- `FRONTEND_AGENT_MODEL`, `MAX_CODEGEN_RETRIES`, `MAX_CONTEXT_TOKENS`, `MAX_FILE_CONTEXT_SIZE`,
  `MAX_GENERATION_TOKENS`, `MAX_FILES_PER_OPERATION`, `MAX_TASK_OPERATIONS`,
  `MAX_TOTAL_OPERATION_SIZE`, `FRONTEND_AGENT_RATE_LIMIT_WINDOW_MS`,
  `FRONTEND_AGENT_RATE_LIMIT_MAX_REQUESTS` — all optional, control the Frontend Agent's model,
  retry budget, context/output size limits, and rate limit (see
  `server/src/config/frontendAgent.config.ts`); same `OPENAI_API_KEY` powers code generation
- `BACKEND_AGENT_MODEL` — optional, overrides `AI_MODEL` for the Backend Agent (Phase 7). It reuses
  every other limit/rate-limit variable listed above — there is no separate
  `MAX_TASK_OPERATIONS`/rate-limit pair for the Backend Agent (see
  `server/src/config/backendAgent.config.ts`)
- `DATABASE_AGENT_MODEL` — optional, overrides `AI_MODEL` for the Database Agent (Phase 8). Same
  reuse pattern as `BACKEND_AGENT_MODEL` (see `server/src/config/databaseAgent.config.ts`)
- `AI_AUTO_APPLY` — must stay `false` (the default); changes always require explicit user approval
  in this phase regardless of this flag
- `SANDBOX_IMAGE_TAG` and the other `SANDBOX_*` variables — all optional, control the Docker
  sandbox's resource limits/timeouts (see `server/src/sandbox/sandbox.config.ts`); requires Docker
  Desktop/Engine running locally
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL` — from step 4 (required — the
  server won't boot without them; use placeholder values if you don't need GitHub locally yet)
- `GITHUB_TOKEN_ENCRYPTION_KEY` — from step 4 (required, 32-byte base64)
- `GIT_WORKDIR_ROOT` — optional, where per-project git working copies live on disk
- `RENDER_API_KEY` — from step 5 (optional — everything except an actual deploy works without it)
- `GITHUB_WEBHOOK_SECRET` — from step 5's webhook setup (optional — only needed for auto-deploy on
  push / PR preview deployments)

**`client/.env.local`**

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — same Clerk app as the server
- `NEXT_PUBLIC_API_URL` — `http://localhost:8080/api` for local dev

## 7. Install and run

```bash
npm install
npm run build --workspace=shared
npm run dev
```

Visit `http://localhost:3000`, sign up, and you should land on `/dashboard` with an empty project
list ready to go.

## Deploying

- **Client → Vercel**: import the repo, set the root directory to `client/`, and add the
  `client/.env.example` variables (with your production Clerk keys and the deployed API URL) in
  Vercel's project settings.
- **Server → Railway**: deploy the `server/` directory (or the whole repo with a custom root),
  set the `server/.env.example` variables in Railway's project settings, and point Clerk's webhook
  at the Railway URL.
- Update `CLIENT_URL` (server) and `NEXT_PUBLIC_API_URL` (client) to the real deployed URLs on
  both sides, and update the Clerk webhook endpoint to the production API URL.
- Update the GitHub OAuth App's callback URL and `GITHUB_CALLBACK_URL` to the production API URL,
  and (if using auto-deploy/PR previews) the GitHub webhook's payload URL.
- Never commit real values for `GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY`,
  `RENDER_API_KEY`, or `GITHUB_WEBHOOK_SECRET` — set them directly in your hosting provider's
  environment variable settings, the same as `CLERK_SECRET_KEY`.
