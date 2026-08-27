import type { IWorkflowEvent } from 'shared';

/** The workflow SSE endpoint frames every message as `{ type: 'replay' | 'live', event }` — a
 *  buffered/historical event vs one that just fired live — so the client can render a subtle visual
 *  distinction if useful, though today both render identically. */
export interface WorkflowReplayStreamEvent {
  type: 'replay';
  event: IWorkflowEvent;
}

export interface WorkflowLiveStreamEvent {
  type: 'live';
  event: IWorkflowEvent;
}

export type WorkflowStreamEvent = WorkflowReplayStreamEvent | WorkflowLiveStreamEvent;
