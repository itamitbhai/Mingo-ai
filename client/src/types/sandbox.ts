import type { ISandboxEvent } from 'shared';

/** The sandbox events SSE endpoint streams raw `ISandboxEvent` frames directly — unlike workflows,
 *  there's no buffered replay (a sandbox run is short-lived; its final result is already on the
 *  `SandboxSession` document the moment it finishes, fetchable via `GET /sandbox/:id`). */
export type SandboxStreamEvent = ISandboxEvent;
