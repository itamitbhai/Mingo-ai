# API Reference

Base URL: `http://localhost:8080/api` in development.

All endpoints except `/health` and `/webhooks/clerk` require a Clerk session — send
`Authorization: Bearer <token>`, where `<token>` comes from `auth().getToken()` (server) or
`useAuth().getToken()` (client).

Every response is JSON in one of two shapes:

```jsonc
// success
{ "success": true, "data": { /* ... */ }, "message": "optional" }

// failure
{ "success": false, "message": "Human-readable error", "errors": { "field": ["reason"] } }
```

## Health

`GET /health` — no auth. Returns `{ status: "ok", timestamp }`.

## Projects

| Method | Path                        | Body / Query                                   | Description                          |
| ------ | --------------------------- | ----------------------------------------------- | ------------------------------------- |
| GET    | `/projects`                 | `search, status, page, limit, sort`             | Paginated list, scoped to the caller  |
| POST   | `/projects`                 | `CreateProjectInput`                            | Create a project                      |
| GET    | `/projects/:id`              | —                                               | Get one project                       |
| PUT    | `/projects/:id`              | `UpdateProjectInput` (partial)                  | Update a project                      |
| DELETE | `/projects/:id`              | —                                               | Delete a project                      |
| PATCH  | `/projects/:id/archive`      | —                                               | Toggle archived/active status         |
| POST   | `/projects/:id/duplicate`    | —                                               | Clone a project as a new draft        |

`CreateProjectInput` (see `shared/src/schemas.ts` for the exact Zod schema):

```ts
{
  name: string;            // 3-60 chars
  description: string;     // 10-500 chars
  frontend: 'React' | 'Next.js' | 'Vue';
  backend: 'Express' | 'Node' | 'NestJS';
  database: 'MongoDB';
  authentication: 'JWT' | 'Clerk' | 'Firebase';
  styling: 'Tailwind' | 'Shadcn';
  deployment: 'Vercel' | 'Railway' | 'Render';
}
```

## Conversations

All scoped to the caller's own projects — accessing another user's project/conversation returns
`404` (ownership is enforced by scoping every query to the caller, the same pattern `/projects`
uses, rather than a separate 403 path).

| Method | Path                                    | Body / Query           | Description                          |
| ------ | ---------------------------------------- | ------------------------ | ------------------------------------- |
| GET    | `/projects/:projectId/conversations`     | —                       | List conversations for a project (newest first) |
| POST   | `/projects/:projectId/conversations`     | `{ title? }`            | Create a conversation (default title "New Conversation") |
| GET    | `/conversations/:conversationId`         | —                       | Get one conversation                  |
| PATCH  | `/conversations/:conversationId`         | `{ title }`             | Rename a conversation                 |
| DELETE | `/conversations/:conversationId`         | —                       | Delete a conversation and its messages |

## Messages

| Method | Path                                             | Body / Query                        | Description                          |
| ------ | -------------------------------------------------| -------------------------------------| ------------------------------------- |
| GET    | `/conversations/:conversationId/messages`        | `cursor?, limit` (default 30, max 50)| Cursor-paginated messages, oldest→newest per page, newest page first |
| POST   | `/conversations/:conversationId/messages`        | `{ content }` **or** `{ retryMessageId }` (exactly one) | Send a message, or regenerate a failed assistant reply — streams the AI's response |

The POST endpoint is rate-limited per signed-in user (`AI_RATE_LIMIT_MAX_REQUESTS` per
`AI_RATE_LIMIT_WINDOW_MS`, default 10/minute) on top of the global API rate limit, and responds
with `Content-Type: text/event-stream` instead of JSON. It's consumed with `fetch` +
`response.body.getReader()` rather than the browser `EventSource` API, since the request needs a
JSON body and an `Authorization` header. Each frame is `data: <json>\n\n`, where the JSON is one of:

```jsonc
{ "type": "user_message", "message": { /* IMessage */ } }     // once, echoes the persisted user message
{ "type": "assistant_start", "message": { /* IMessage */ } }  // once, the empty assistant placeholder
{ "type": "delta", "content": "..." }                          // zero or more, a chunk of the reply
{ "type": "done", "message": { /* IMessage */ } }               // on success, the final assistant message
{ "type": "error", "message": "...", "messageId": "..." }       // on failure, a friendly error message
```

To stop an in-flight generation, abort the `fetch` request (`AbortController`) — the server detects
the dropped connection, cancels the upstream OpenAI request, and marks the message `cancelled`.
There is no separate "stop" endpoint.

## Files & folders (workspace)

MongoDB is the entire "filesystem" — there is no real disk I/O anywhere in this API. Every `path`
is normalized and validated (`shared`'s `isValidRelativePath`) before it's used in a query, and
every query is additionally scoped to `{ project, owner }`, so a crafted path like `../../secret`
or `/etc/passwd` is rejected with `400` before it ever reaches Mongo — it can't "escape" a project's
own documents because there's no filesystem to escape to.

| Method | Path                                              | Body / Query                          | Description |
| ------ | -------------------------------------------------- | --------------------------------------- | ------------- |
| GET    | `/projects/:projectId/files`                       | —                                      | Full file tree (metadata only, no `content`), folders-first then alphabetical |
| GET    | `/projects/:projectId/files/content`               | `path`                                 | One file's content + `version` |
| GET    | `/projects/:projectId/files/search`                | `q`                                    | Case-insensitive scan of stored file contents (max 50 files, 5 matching lines each) |
| POST   | `/projects/:projectId/files`                       | `{ path, content? }`                  | Create a file (parent folder, if any, must already exist) |
| POST   | `/projects/:projectId/folders`                     | `{ path }`                            | Create a folder |
| PATCH  | `/projects/:projectId/files`                       | `{ path, content, expectedVersion? }` | Update a file's content |
| PATCH  | `/projects/:projectId/files/rename`                | `{ path, newName }`                   | Rename a file or folder (folder rename cascades to every descendant) |
| DELETE | `/projects/:projectId/files`                       | `{ path }`                            | Delete a file, or a folder and everything inside it |

**Version conflicts**: pass the `version` you last loaded as `expectedVersion` on a content update.
If it no longer matches (someone/something else saved in between), the request fails with `409` and
the message "This file was changed elsewhere. Reload before saving." — omit `expectedVersion` to
save unconditionally.

## Workspace engine

Built on top of the files/folders endpoints above — every mutation there also produces the version
history, activity log, and cache invalidation this section's endpoints read from. Same ownership
model: every path/id is scoped to `{ project, owner }`, so cross-project and cross-user access
return `404`, not `403`.

| Method | Path                                                        | Body / Query                     | Description |
| ------ | ------------------------------------------------------------ | ---------------------------------- | ------------- |
| GET    | `/projects/:projectId/workspace`                              | —                                 | Get (or lazily create) the project's `ProjectWorkspace` |
| GET    | `/projects/:projectId/workspace/tree`                         | —                                 | Cached file tree (same shape as `/files`, backed by an in-memory cache) |
| GET    | `/projects/:projectId/workspace/manifest`                     | —                                 | Framework/language/package manager, file+folder counts, entry points, `package.json` deps/scripts — all computed live from the project's actual files |
| GET    | `/projects/:projectId/workspace/activity`                     | `cursor?, limit`                  | Cursor-paginated `WorkspaceActivity` log (create/update/delete/rename/move/restore/snapshot/workspace_init) |
| GET    | `/projects/:projectId/workspace/versions`                     | `path, cursor?, limit`            | Cursor-paginated version history for one file (content omitted — see below) |
| GET    | `/projects/:projectId/workspace/versions/:versionId`          | —                                 | One version's full content, for the diff viewer |
| GET    | `/projects/:projectId/workspace/snapshots`                    | `page?, limit?`                   | Paginated list of snapshots (metadata only) |
| POST   | `/projects/:projectId/workspace/snapshots`                    | `{ name, description? }`          | Create a snapshot of the current workspace state |
| POST   | `/projects/:projectId/workspace/snapshots/:snapshotId/restore`| —                                 | Restore a snapshot — always creates an automatic backup snapshot of the current state first |
| POST   | `/projects/:projectId/workspace/preview`                      | `{ operations: BatchOperation[] }`| Validates a batch of operations against the current state without writing anything |
| POST   | `/projects/:projectId/workspace/batch`                        | `{ operations: BatchOperation[] }`| Applies a batch as one logical change — rejects the whole batch if any operation is invalid |
| PATCH  | `/projects/:projectId/workspace/move`                         | `{ path, destinationPath }`       | Move a file or folder to an arbitrary destination (as opposed to `/files/rename`, which only changes the leaf name within the same parent) |

A `BatchOperation` is one of:

```ts
{ type: 'create'; path: string; content?: string }
{ type: 'update'; path: string; content: string }
{ type: 'delete'; path: string }
{ type: 'rename'; path: string; newName: string }
{ type: 'move'; path: string; destinationPath: string }
```

`/preview` and `/batch` share the same validation: unsafe paths, oversized content, conflicting
targets, and duplicate operations within the same batch are all reported before anything is written.
Missing parent folders for a `create`/`move` destination are synthesized automatically (an AI agent
can create `src/auth/auth.service.ts` without first creating `src/auth`). The preview response is:

```jsonc
{
  "valid": false,
  "operations": [{ "type": "create", "path": "src/auth/auth.service.ts", "action": "CREATE" }],
  "warnings": [],
  "errors": [],
  "conflicts": ["\"src/auth/auth.service.ts\" already exists"]
}
```

**Checksums**: every `ProjectFile` carries a SHA-256 `checksum` of its content, used to detect real
changes (skip a no-op save), verify snapshot/version integrity, and support future sync — never as
authentication.

## Planner Agent

Turns a natural-language request into a structured, versioned `ProjectPlan` — planning only, never
code generation, file writes, or command execution. Same ownership model as everything else: every
`planId` is scoped to `{project, owner}`.

| Method | Path                                              | Body / Query           | Description |
| ------ | -------------------------------------------------- | ------------------------ | ------------- |
| POST   | `/projects/:projectId/plans`                       | `{ prompt, conversationId? }` (SSE) | Generate a new plan — streams progress, ends with `done`/`error` |
| GET    | `/projects/:projectId/plans`                       | `page?, limit?`          | Paginated plan history, newest version first |
| GET    | `/projects/:projectId/plans/:planId`               | —                        | Get one plan (full) |
| POST   | `/projects/:projectId/plans/:planId/regenerate`    | `{ prompt? }` (SSE)      | Regenerate — reuses the original prompt if none given; response includes the new plan, the previous plan, and a diff |
| PATCH  | `/projects/:projectId/plans/:planId`                | `{ status? }` or `{ featureEdits?, taskEdits? }` | Approve/reject, or edit specific feature/task fields |
| DELETE | `/projects/:projectId/plans/:planId`                | —                        | Delete — only allowed when `status` is `draft`, `rejected`, or `failed` |

**Generation is rate-limited** separately from chat (`PLANNER_RATE_LIMIT_MAX_REQUESTS` per
`PLANNER_RATE_LIMIT_WINDOW_MS`, default 5 per 10 minutes) — it's a more expensive, multi-attempt AI
call. Both `POST /plans` and `POST /plans/:planId/regenerate` are SSE (`text/event-stream`),
consumed the same way as chat messages (`fetch` + `ReadableStream`, not `EventSource`). Each frame
is `data: <json>\n\n`, where the JSON is one of:

```jsonc
{ "type": "stage", "stage": "loading_context", "label": "Loading project context…" }
{ "type": "stage", "stage": "generating", "label": "Generating the plan…", "attempt": 1 }
{ "type": "stage", "stage": "retrying", "label": "Fixing plan issues (attempt 2 of 3)…", "attempt": 2 }
{ "type": "stage", "stage": "saving", "label": "Saving the plan…" }
{ "type": "done", "plan": { /* IProjectPlan */ }, "previousPlan": { /* only on regenerate */ }, "diff": { /* only on regenerate */ } }
{ "type": "error", "message": "..." }
```

**Plan status**: `draft → generating → ready → approved | rejected`, plus `failed` (the AI could
not produce a valid plan after retries — the plan is still persisted with an `error` message, no
structured content) and `executing`/`completed`/`cancelled` (reserved for a future execution
phase — Phase 5 never transitions a plan into these). Approving a plan only sets its status; it
never writes files, runs commands, or triggers any other agent.

**Editing** (`PATCH`) only accepts a small whitelist: a feature's `title`/`description`/`priority`,
or a task's `title`/`description`/`acceptanceCriteria`, addressed by `id` — never a full plan
replacement. The edited plan is re-validated in full before saving.

## Frontend Agent

Turns one **approved**, frontend-typed task from a `ProjectPlan` into a previewed, then
(only on explicit approval) applied, set of file operations. Same ownership model as everything
else: every `planId`/`taskId`/`generationId` is scoped to `{project, owner}`.

| Method | Path                                                                        | Body / Query        | Description |
| ------ | ----------------------------------------------------------------------------- | ---------------------- | ------------- |
| GET    | `/projects/:projectId/plans/:planId/tasks`                                    | —                       | Task board — plan tasks merged with live execution status |
| POST   | `/projects/:projectId/plans/:planId/tasks/:taskId/execute`                    | `{}` (SSE)              | Run the Frontend Agent on this task — streams progress, ends with `done`/`error` |
| POST   | `/projects/:projectId/plans/:planId/tasks/:taskId/regenerate`                 | `{ feedback? }` (SSE)   | Regenerate with optional user feedback — adds a new generation version, never overwrites the previous one |
| GET    | `/projects/:projectId/plans/:planId/tasks/:taskId/generations`                | —                       | Generation history for this task, newest version first |
| GET    | `/projects/:projectId/plans/:planId/tasks/:taskId/generations/:generationId`  | —                       | Get one generation |
| POST   | `/projects/:projectId/workspace/ai/apply`                                     | `{ generationId }`      | Apply a `preview_ready` generation — snapshots the workspace, then applies atomically |
| POST   | `/projects/:projectId/workspace/ai/reject`                                    | `{ generationId }`      | Reject a `preview_ready` generation — no filesystem writes |

**Execution/regeneration is rate-limited** the same way as plan generation
(`FRONTEND_AGENT_RATE_LIMIT_MAX_REQUESTS` per `FRONTEND_AGENT_RATE_LIMIT_WINDOW_MS`, default 5 per
10 minutes). Both `execute` and `regenerate` are SSE, same wire format as the Planner:

```jsonc
{ "type": "stage", "stage": "loading_context", "label": "Reading project context…" }
{ "type": "stage", "stage": "reading_files", "label": "Inspecting existing components…" }
{ "type": "stage", "stage": "generating", "label": "Generating code…", "attempt": 1 }
{ "type": "stage", "stage": "retrying", "label": "Fixing issues (attempt 2 of 3)…", "attempt": 2 }
{ "type": "stage", "stage": "preview_ready", "label": "Changes ready for review." }
{ "type": "done", "generation": { /* IAgentGeneration */ } }
{ "type": "error", "message": "..." }
```

**Preconditions, checked in order, before any AI call**: the plan must be `status: 'approved'`; the
task must be frontend-typed (`type === 'frontend'` or `recommendedAgent === 'frontend'` — anything
else is rejected with `"This task belongs to the <X> Agent, not the Frontend Agent."`); every id in
`task.dependencies` must have a `completed` `TaskExecution` (otherwise the task is marked `blocked`
and rejected with `"Waiting for required tasks."`); the task must not already be running (a second
concurrent `execute`/`regenerate` gets `409 Task already running.`).

**Apply is never automatic.** A generation only reaches `preview_ready` after passing Zod +
semantic validation (path traversal, `.env`/`.git`/`node_modules`/secrets blocked, size/count
limits); applying it still requires a separate, explicit `POST /workspace/ai/apply` naming that
exact `generationId`, which re-validates the operations against the *current* workspace state
before writing anything.

## Profile

| Method | Path        | Body                  | Description                                    |
| ------ | ----------- | ---------------------- | ------------------------------------------------ |
| GET    | `/profile`  | —                      | Get the current user                             |
| PUT    | `/profile`  | `UpdateProfileInput`   | Update name, workspace, or bio                   |
| DELETE | `/profile`  | —                      | Delete the account and cascade-delete its data   |

## Settings

| Method | Path        | Body                    | Description                            |
| ------ | ----------- | ------------------------ | ---------------------------------------- |
| GET    | `/settings` | —                        | Get (or lazily create) user settings     |
| PUT    | `/settings` | `UpdateSettingsInput`    | Update theme / notification preferences  |

## Dashboard

| Method | Path                 | Description                                                          |
| ------ | -------------------- | ---------------------------------------------------------------------- |
| GET    | `/dashboard/overview` | Stats (project counts, plan usage), recent projects, recent activity |

## Webhooks

`POST /webhooks/clerk` — verified via Svix using `CLERK_WEBHOOK_SECRET`. Handles `user.created`,
`user.updated`, and `user.deleted` to keep the local `User` collection in sync with Clerk. Point
this at `https://<your-api-domain>/api/webhooks/clerk` from the Clerk Dashboard → Webhooks.

## Errors

| Status | Meaning                                                          |
| ------ | ------------------------------------------------------------------ |
| 400    | Validation failed (see `errors`) or a malformed request            |
| 401    | Missing/invalid Clerk session                                      |
| 404    | Resource not found, or not owned by the caller                     |
| 409    | Duplicate key (e.g. an email that's already registered)            |
| 429    | Rate limit exceeded                                                |
| 500    | Unexpected server error                                            |
