import { FailureCategory } from 'shared';
import { orchestratorConfig } from '../config/orchestrator.config';
import { AIProviderError } from '../services/ai/ai.types';
import { ApiError } from '../utils/ApiError';

/**
 * Classifies why a task failed (Phase 10 spec §23) so `isRetryable`/`shouldRetry` can decide whether
 * an automatic retry is safe. Never guesses in the AI's favor: an unrecognized error always falls
 * through to `UNKNOWN_ERROR`, which is not retryable.
 */
export function classifyFailure(err: unknown): FailureCategory {
  if (err instanceof AIProviderError) {
    if (err.code === 'timeout') return FailureCategory.TIMEOUT;
    if (err.code === 'rate_limit' || err.code === 'unavailable') return FailureCategory.AI_ERROR;
    if (err.code === 'auth' || err.code === 'not_configured') return FailureCategory.AUTHORIZATION_ERROR;
    return FailureCategory.AI_ERROR;
  }

  // Every agent's own `<Agent>ValidationError` (thrown once its internal correction-retry loop is
  // exhausted) means the AI's output was structurally/semantically invalid — never auto-retried at
  // the orchestrator level (spec §22: "Do NOT blindly retry: invalid AI output").
  if (err instanceof Error && err.name.endsWith('ValidationError')) {
    return FailureCategory.VALIDATION_ERROR;
  }

  if (err instanceof ApiError) {
    if (err.statusCode === 401 || err.statusCode === 403) return FailureCategory.AUTHORIZATION_ERROR;

    if (err.statusCode === 409) {
      return err.message.toLowerCase().includes('locked') ? FailureCategory.FILE_CONFLICT : FailureCategory.RUNTIME_ERROR;
    }

    if (err.statusCode === 400) {
      // Every agent's `checkDependencies` throws exactly this shape — `{ dependencies: string[] }` —
      // a structural check, not a fragile message-text match.
      if (err.errors && 'dependencies' in err.errors) return FailureCategory.DEPENDENCY_ERROR;

      const message = err.message.toLowerCase();
      if (message.includes('depend')) return FailureCategory.DEPENDENCY_ERROR;
      if (message.includes('security') || message.includes('forbidden') || message.includes('protected')) {
        return FailureCategory.SECURITY_ERROR;
      }
      return FailureCategory.VALIDATION_ERROR;
    }

    if (err.statusCode >= 500) return FailureCategory.RUNTIME_ERROR;
  }

  if (err instanceof Error && /\btimed?[\s-]?out\b/i.test(err.message)) {
    return FailureCategory.TIMEOUT;
  }

  return FailureCategory.UNKNOWN_ERROR;
}

/** Only transient categories ever auto-retry — everything else (invalid AI output, a security
 *  violation, a dependency conflict, an authorization failure) requires a human or a fix task, never
 *  a blind retry (spec §22). */
const RETRYABLE_CATEGORIES: FailureCategory[] = [
  FailureCategory.AI_ERROR,
  FailureCategory.TIMEOUT,
  FailureCategory.RUNTIME_ERROR,
];

export function isRetryable(category: FailureCategory): boolean {
  return RETRYABLE_CATEGORIES.includes(category);
}

export function shouldRetry(category: FailureCategory, attemptsSoFar: number): boolean {
  return isRetryable(category) && attemptsSoFar < orchestratorConfig.MAX_RETRIES;
}
