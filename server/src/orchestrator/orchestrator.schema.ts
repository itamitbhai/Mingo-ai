import { CreateWorkflowInput, WorkflowMode } from 'shared';

export { createWorkflowSchema } from 'shared';
export type { CreateWorkflowInput } from 'shared';

/** Normalizes the already-Zod-validated request body into the shape
 * `orchestrator.service.createWorkflow` expects — the only translation needed today is the `mode`
 * string literal into the `WorkflowMode` enum value (identical strings, kept as a real function
 * rather than a bare cast so a future divergence between the two doesn't silently compile). */
export function toCreateWorkflowParams(body: CreateWorkflowInput) {
  return {
    prompt: body.prompt,
    conversationId: body.conversationId,
    planId: body.planId,
    mode: body.mode === 'auto' ? WorkflowMode.AUTO : WorkflowMode.REVIEW,
  };
}
