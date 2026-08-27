import { EventEmitter } from 'node:events';
import { IWorkflowEvent } from 'shared';
import { orchestratorConfig } from '../config/orchestrator.config';
import { WorkflowModel } from '../models';
import { logger } from '../utils/logger';

/**
 * In-process pub/sub for live workflow events (Phase 10 spec §19-21) — a Node `EventEmitter`, not a
 * new dependency. Every real-time surface in this codebase (Planner, Frontend/Backend/Database/
 * Testing agent execution, Autopilot) is already per-request SSE with no Socket.IO layer anywhere;
 * this is the same idea generalized to "subscribe to a workflow that might already be running,"
 * which a single-request SSE stream can't express on its own. `publish` always persists to the
 * capped `Workflow.events` array first (atomic `$push`+`$slice`, so concurrent task executions never
 * race each other) so a client that connects *after* an event fired can still see recent history via
 * `GET /workflows/:id`, and only then fans out to whoever's listening live right now.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0); // an unbounded number of workflows/subscribers may be live at once

function channel(workflowId: string): string {
  return `workflow:${workflowId}`;
}

export function subscribe(workflowId: string, listener: (event: IWorkflowEvent) => void): () => void {
  emitter.on(channel(workflowId), listener);
  return () => emitter.off(channel(workflowId), listener);
}

export async function publish(
  workflowId: string,
  partial: Omit<IWorkflowEvent, 'workflowId' | 'timestamp'>
): Promise<IWorkflowEvent> {
  const event: IWorkflowEvent = { ...partial, workflowId, timestamp: new Date().toISOString() };

  await WorkflowModel.findByIdAndUpdate(workflowId, {
    $push: { events: { $each: [event], $slice: -orchestratorConfig.MAX_EVENTS } },
  }).catch((err) => {
    logger.error('orchestrator.events.persist_failed', {
      workflowId,
      error: err instanceof Error ? err.message : err,
    });
  });

  emitter.emit(channel(workflowId), event);
  return event;
}
