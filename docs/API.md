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
