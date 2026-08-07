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
