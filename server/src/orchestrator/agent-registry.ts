import { AgentType, IPlanTask } from 'shared';
import {
  BACKEND_AGENT_DEFINITION,
  DATABASE_AGENT_DEFINITION,
  FRONTEND_AGENT_DEFINITION,
  TESTING_AGENT_DEFINITION,
} from '../agents/agent.types';
import * as backendAgentService from '../agents/backend/backend.service';
import * as databaseAgentService from '../agents/database/database.service';
import * as frontendAgentService from '../agents/frontend/frontend.service';
import * as testingAgentService from '../agents/testing/testing.service';

/**
 * Central Agent Registry (Phase 10 spec §7/§8) — a generalized version of
 * `task-agent.controller.ts`'s `pickAgentService`, used by the orchestrator wherever it needs to
 * dispatch a task to its owning agent. Deliberately returns the real service module (a union of the
 * four concrete modules), not a hand-rolled adapter interface: every one of the four already exports
 * the identical shape (`isXTask`, `describeOwningAgent`, `executeTask`, `applyGeneration`,
 * `rejectGeneration`, `listGenerations`, `getGeneration`) — introducing a narrower artificial
 * interface here would only fight TypeScript's contravariant callback checking on each agent's own
 * `OnXStage` type for no real benefit. Callers pass an unannotated inline `onStage` arrow function at
 * the call site (exactly like `task-agent.controller.ts` already does) and let TS's union
 * call-signature resolution handle it.
 */
export const AGENT_DEFINITIONS = [
  FRONTEND_AGENT_DEFINITION,
  BACKEND_AGENT_DEFINITION,
  DATABASE_AGENT_DEFINITION,
  TESTING_AGENT_DEFINITION,
];

/** Same precedence order as `task-agent.controller.ts`'s `pickAgentService` — backend/database/testing
 *  are checked first (each an explicit, narrower match); frontend is the fallback. */
export function getAgentForTask(task: IPlanTask) {
  if (backendAgentService.isBackendTask(task)) return backendAgentService;
  if (databaseAgentService.isDatabaseTask(task)) return databaseAgentService;
  if (testingAgentService.isTestingTask(task)) return testingAgentService;
  return frontendAgentService;
}

/** The `AgentType` id for a task — used to label `WorkflowTaskState.agentId` and for the affected-file
 *  overlap check (spec §14/§15) to know which agent owns which files without re-deriving it. */
export function getAgentIdForTask(task: IPlanTask): AgentType {
  if (backendAgentService.isBackendTask(task)) return 'backend';
  if (databaseAgentService.isDatabaseTask(task)) return 'database';
  if (testingAgentService.isTestingTask(task)) return 'testing';
  return 'frontend';
}

/** Whether the orchestrator can actually run this task at all — mirrors the task board's
 *  `isFrontendTask || isBackendTask || isDatabaseTask || isTestingTask` gate (spec §38/§39: the
 *  orchestrator must not bypass agent permissions, and a devops/security/deployment-typed task still
 *  has no agent to run it). */
export function isOrchestrable(task: IPlanTask): boolean {
  return (
    frontendAgentService.isFrontendTask(task) ||
    backendAgentService.isBackendTask(task) ||
    databaseAgentService.isDatabaseTask(task) ||
    testingAgentService.isTestingTask(task)
  );
}
