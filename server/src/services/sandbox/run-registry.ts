/**
 * In-memory `testRunId -> AbortController` registry so `POST .../test-runs/:id/cancel` can abort a
 * live run (spec §57). Same single-instance assumption `rateLimit.middleware.ts`'s
 * `MemoryRateLimitStore` already makes — a multi-instance deployment would need to swap this for a
 * shared store, exactly like that comment already flags for rate limiting.
 */
const activeRuns = new Map<string, AbortController>();

export function registerRun(testRunId: string, controller: AbortController): void {
  activeRuns.set(testRunId, controller);
}

export function unregisterRun(testRunId: string): void {
  activeRuns.delete(testRunId);
}

export function cancelRun(testRunId: string): boolean {
  const controller = activeRuns.get(testRunId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export function isRunActive(testRunId: string): boolean {
  return activeRuns.has(testRunId);
}
