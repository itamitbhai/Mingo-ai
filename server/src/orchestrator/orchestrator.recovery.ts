import { Types } from 'mongoose';
import { TestResultStatus, TestRunStatus, WorkflowEventType, WorkflowMode } from 'shared';
import { orchestratorConfig } from '../config/orchestrator.config';
import * as testingAgentService from '../agents/testing/testing.service';
import { logger } from '../utils/logger';
import { publish } from './orchestrator.events';

export interface FixLoopResult {
  passed: boolean;
  message: string;
}

/**
 * The test-failure → fix-task loop (Phase 10 spec §25-27) — runs the tests a just-completed Testing
 * Agent task added, and if any fail, routes each failure to the exact *file* that owns it (Phase 9's
 * `testingAgentService.generateTestFix` already scopes a fix to the failing test's own file/stack
 * trace, which is functionally "the correct agent's file" regardless of which agent conceptually
 * authored it — spec §26's "Assigned Agent: Backend" maps onto this as "the fix targets a backend
 * source file," not a separate per-agent fix pathway). Bounded by `MAX_FIX_CYCLES` (spec §27) — after
 * that many unsuccessful rounds, stops and returns a clear message rather than looping forever.
 *
 * In `review` mode this only ever runs ONE fix-generation round: it never auto-applies, so looping
 * further would just regenerate the same unreviewed fixes — the caller is expected to apply/reject
 * them (through the existing, unmodified apply/reject flow) and re-trigger testing itself afterward
 * (e.g. via Resume).
 */
export async function runTestingAndFixLoop(params: {
  owner: Types.ObjectId;
  projectId: string;
  planId: string;
  workflowId: string;
  taskId: string;
  mode: WorkflowMode;
  signal: AbortSignal;
}): Promise<FixLoopResult> {
  const { owner, projectId, planId, workflowId, taskId, mode, signal } = params;

  let cycle = 0;

  while (true) {
    await publish(workflowId, {
      type: WorkflowEventType.TEST_STARTED,
      taskId,
      agentId: 'testing',
      message: cycle === 0 ? 'Running tests…' : `Re-running tests after fix (cycle ${cycle})…`,
    });

    const testRun = await testingAgentService.createTestRun(owner, projectId, planId, taskId, 'all');
    const completed = await testingAgentService.runTestRun(testRun, owner, projectId, signal);

    await publish(workflowId, {
      type: WorkflowEventType.TEST_COMPLETED,
      taskId,
      agentId: 'testing',
      message: `Tests: ${completed.summary?.passed ?? 0} passed, ${completed.summary?.failed ?? 0} failed`,
    });

    const failedResults = completed.results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === TestResultStatus.FAILED);

    const genuinelyPassed =
      completed.status === TestRunStatus.PASSED || (completed.status !== TestRunStatus.ERROR && failedResults.length === 0);

    if (genuinelyPassed) {
      return { passed: true, message: 'All tests passed.' };
    }

    if (cycle >= orchestratorConfig.MAX_FIX_CYCLES) {
      return {
        passed: false,
        message: `Automatic fixing stopped after ${orchestratorConfig.MAX_FIX_CYCLES} attempts.`,
      };
    }

    await publish(workflowId, {
      type: WorkflowEventType.FIX_STARTED,
      taskId,
      message: `Generating fixes for ${failedResults.length} failing test(s)…`,
    });

    let anyFixApplied = false;
    for (const { result, index } of failedResults) {
      try {
        const fixGeneration = await testingAgentService.generateTestFix(owner, projectId, testRun.id, index, signal);

        if (mode === WorkflowMode.AUTO) {
          await testingAgentService.applyGeneration(owner, projectId, fixGeneration.id);
          anyFixApplied = true;
        } else {
          await publish(workflowId, {
            type: WorkflowEventType.TASK_NEEDS_REVIEW,
            taskId,
            message: `A fix for "${result.test}" is ready for review.`,
          });
        }
      } catch (err) {
        logger.error('orchestrator.fix.failed', {
          workflowId,
          taskId,
          test: result.test,
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    cycle += 1;

    if (mode !== WorkflowMode.AUTO) {
      // Nothing was auto-applied — further cycles would just regenerate the same unreviewed fixes.
      return anyFixApplied
        ? { passed: false, message: 'Some fixes were applied; re-run tests to continue.' }
        : { passed: false, message: 'Fixes are ready for review — approve them, then re-run tests.' };
    }

    if (!anyFixApplied) {
      // Every fix attempt this cycle failed outright (not "needs review" — actually threw) — looping
      // further won't help.
      return { passed: false, message: 'Could not generate a usable fix for the failing test(s).' };
    }
  }
}
