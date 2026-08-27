import { Types } from 'mongoose';
import {
  AgentGenerationStatus,
  FailureCategory,
  IPlanTask,
  WorkflowEventType,
  WorkflowMode,
  WorkflowTaskStatus,
} from 'shared';
import { getAgentForTask, getAgentIdForTask } from './agent-registry';
import { publish } from './orchestrator.events';
import { classifyFailure } from './orchestrator.retry';

export interface ExecuteWorkflowTaskParams {
  owner: Types.ObjectId;
  projectId: string;
  planId: string;
  workflowId: string;
  task: IPlanTask;
  mode: WorkflowMode;
  signal: AbortSignal;
}

export interface ExecuteWorkflowTaskResult {
  status: typeof WorkflowTaskStatus.COMPLETED | typeof WorkflowTaskStatus.NEEDS_REVIEW | typeof WorkflowTaskStatus.FAILED;
  generationId?: string;
  error?: string;
  failureCategory?: FailureCategory;
}

interface AutoApplicableGeneration {
  status: AgentGenerationStatus;
  dependencyRequests?: unknown[];
  contractWarnings?: string[];
}

/**
 * Whether a `review`-free `mode: 'auto'` workflow may apply this generation without stopping for the
 * user (spec §16) — every one of these still forces `needs_review` regardless of mode: a requested
 * new dependency, a noticed contract mismatch, or a generation that isn't even preview-ready.
 * "Destructive" file operations (delete/rename/move) are *not* singled out here beyond this — they
 * still go through the exact same snapshot-before-apply + rollback-on-failure path every agent's
 * `applyXOperations` already uses, so a bad auto-applied delete is always recoverable via that
 * snapshot, not merely "reviewed harder" up front.
 */
function isAutoApplicable(generation: AutoApplicableGeneration): boolean {
  return (
    generation.status === AgentGenerationStatus.PREVIEW_READY &&
    (generation.dependencyRequests?.length ?? 0) === 0 &&
    (generation.contractWarnings?.length ?? 0) === 0
  );
}

/**
 * Runs exactly one workflow task end to end (Phase 10 spec §11 steps 4-8): dispatch to the owning
 * agent via the registry, generate, decide auto-apply vs needs-review, apply if appropriate. Never
 * touches the filesystem or an AI provider itself — it only calls the same `executeTask`/
 * `applyGeneration` functions a user clicking "Run"/"Apply" in the UI would call. File-conflict
 * protection during apply is already enforced transitively: every agent's own
 * `applyXOperations` acquires a real workspace lock (`lock.service.acquireLock`) around its batch
 * apply and snapshots first, so a lock conflict here surfaces as a normal `ApiError.conflict` that
 * `classifyFailure` maps to `FILE_CONFLICT`.
 */
export async function executeWorkflowTask({
  owner,
  projectId,
  planId,
  workflowId,
  task,
  mode,
  signal,
}: ExecuteWorkflowTaskParams): Promise<ExecuteWorkflowTaskResult> {
  const service = getAgentForTask(task);
  const agentId = getAgentIdForTask(task);

  await publish(workflowId, {
    type: WorkflowEventType.TASK_STARTED,
    taskId: task.id,
    agentId,
    status: WorkflowTaskStatus.RUNNING,
    message: `Starting "${task.title}"`,
  });
  await publish(workflowId, {
    type: WorkflowEventType.AGENT_STARTED,
    taskId: task.id,
    agentId,
    message: `${agentId} agent generating "${task.title}"…`,
  });

  try {
    const generation = await service.executeTask(owner, projectId, planId, task.id, signal, (event) => {
      void publish(workflowId, {
        type: WorkflowEventType.AGENT_PROGRESS,
        taskId: task.id,
        agentId,
        message: event.label,
      });
    });

    await publish(workflowId, {
      type: WorkflowEventType.AGENT_COMPLETED,
      taskId: task.id,
      agentId,
      message: `${agentId} agent finished "${task.title}"`,
    });

    if (mode !== WorkflowMode.AUTO || !isAutoApplicable(generation)) {
      await publish(workflowId, {
        type: WorkflowEventType.TASK_NEEDS_REVIEW,
        taskId: task.id,
        agentId,
        status: WorkflowTaskStatus.NEEDS_REVIEW,
        message: `"${task.title}" is ready for review`,
      });
      return { status: WorkflowTaskStatus.NEEDS_REVIEW, generationId: generation.id };
    }

    await service.applyGeneration(owner, projectId, generation.id);

    await publish(workflowId, {
      type: WorkflowEventType.TASK_COMPLETED,
      taskId: task.id,
      agentId,
      status: WorkflowTaskStatus.COMPLETED,
      message: `"${task.title}" completed`,
    });

    return { status: WorkflowTaskStatus.COMPLETED, generationId: generation.id };
  } catch (err) {
    const failureCategory = classifyFailure(err);
    const message = err instanceof Error ? err.message : 'This task failed.';

    await publish(workflowId, {
      type: WorkflowEventType.TASK_FAILED,
      taskId: task.id,
      agentId,
      status: WorkflowTaskStatus.FAILED,
      message: `"${task.title}" failed: ${message}`,
    });

    return { status: WorkflowTaskStatus.FAILED, error: message.slice(0, 500), failureCategory };
  }
}
