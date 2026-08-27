import { IPlanTask } from 'shared';

function isPackageJsonPath(path: string): boolean {
  return path === 'package.json' || path.endsWith('/package.json');
}

/**
 * Picks the next batch of ready tasks to dispatch this round (Phase 10 spec §12/§13/§14/§15):
 * capped at the remaining concurrency slots, and greedily skipping any ready task whose
 * `affectedFiles` overlap with a task already claimed *this round* — Frontend UI and Database Schema
 * with no shared files can run together; two tasks that would both touch `package.json` (or any
 * other shared path) are serialized instead of racing, one this round and the other once the first
 * completes and its files free up. This is a pre-flight, plan-declared-`affectedFiles` check —
 * `orchestrator.executor.ts` still acquires a real workspace lock around the actual apply as a second,
 * enforced gate.
 */
export function selectNextBatch(readyTasks: IPlanTask[], runningCount: number, maxConcurrency: number): IPlanTask[] {
  const capacity = Math.max(0, maxConcurrency - runningCount);
  if (capacity === 0) return [];

  const batch: IPlanTask[] = [];
  const claimedFiles = new Set<string>();
  let claimedPackageJson = false;

  for (const task of readyTasks) {
    if (batch.length >= capacity) break;

    const touchesPackageJson = task.affectedFiles.some(isPackageJsonPath);
    if (touchesPackageJson && claimedPackageJson) continue;

    const overlapsClaimedFile = task.affectedFiles.some((path) => claimedFiles.has(path));
    if (overlapsClaimedFile) continue;

    batch.push(task);
    for (const path of task.affectedFiles) claimedFiles.add(path);
    if (touchesPackageJson) claimedPackageJson = true;
  }

  return batch;
}
