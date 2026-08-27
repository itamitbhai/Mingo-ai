import { describe, expect, it } from 'vitest';

vi.mock('../config/orchestrator.config', () => ({
  orchestratorConfig: { MAX_RETRIES: 2 },
}));

import { vi } from 'vitest';
import { FailureCategory } from 'shared';
import { AIProviderError } from '../services/ai/ai.types';
import { ApiError } from '../utils/ApiError';
import { classifyFailure, isRetryable, shouldRetry } from './orchestrator.retry';

describe('classifyFailure', () => {
  it('classifies an AI provider timeout as TIMEOUT', () => {
    expect(classifyFailure(new AIProviderError('timeout', 'timed out'))).toBe(FailureCategory.TIMEOUT);
  });

  it('classifies an AI provider rate limit as AI_ERROR (transient)', () => {
    expect(classifyFailure(new AIProviderError('rate_limit', 'too many requests'))).toBe(FailureCategory.AI_ERROR);
  });

  it('classifies an AI provider auth failure as AUTHORIZATION_ERROR (not transient)', () => {
    expect(classifyFailure(new AIProviderError('auth', 'bad key'))).toBe(FailureCategory.AUTHORIZATION_ERROR);
  });

  it('classifies any "<Agent>ValidationError" as VALIDATION_ERROR', () => {
    class TestingValidationError extends Error {
      constructor() {
        super('bad output');
        this.name = 'TestingValidationError';
      }
    }
    expect(classifyFailure(new TestingValidationError())).toBe(FailureCategory.VALIDATION_ERROR);
  });

  it('classifies a 401/403 ApiError as AUTHORIZATION_ERROR', () => {
    expect(classifyFailure(ApiError.unauthorized())).toBe(FailureCategory.AUTHORIZATION_ERROR);
    expect(classifyFailure(ApiError.forbidden())).toBe(FailureCategory.AUTHORIZATION_ERROR);
  });

  it('classifies a 409 lock conflict as FILE_CONFLICT', () => {
    expect(classifyFailure(ApiError.conflict('This file is locked by another session'))).toBe(
      FailureCategory.FILE_CONFLICT
    );
  });

  it('classifies a 409 that is not a lock message as RUNTIME_ERROR (transient race)', () => {
    expect(classifyFailure(ApiError.conflict('Task already running.'))).toBe(FailureCategory.RUNTIME_ERROR);
  });

  it('classifies the real "waiting for required tasks" shape every agent throws as DEPENDENCY_ERROR', () => {
    // The exact shape `checkDependencies` throws across every agent service:
    // `ApiError.badRequest('Waiting for required tasks.', { dependencies: [...] })`.
    expect(
      classifyFailure(ApiError.badRequest('Waiting for required tasks.', { dependencies: ['TASK-001'] }))
    ).toBe(FailureCategory.DEPENDENCY_ERROR);
  });

  it('classifies a 400 mentioning "depend" in its message as DEPENDENCY_ERROR even without the structured shape', () => {
    expect(classifyFailure(ApiError.badRequest('A dependency is missing'))).toBe(FailureCategory.DEPENDENCY_ERROR);
  });

  it('classifies a 400 mentioning a protected file as SECURITY_ERROR', () => {
    expect(classifyFailure(ApiError.badRequest('".env" is a protected file'))).toBe(FailureCategory.SECURITY_ERROR);
  });

  it('classifies a generic 400 as VALIDATION_ERROR', () => {
    expect(classifyFailure(ApiError.badRequest('Invalid input'))).toBe(FailureCategory.VALIDATION_ERROR);
  });

  it('classifies a 500 as RUNTIME_ERROR', () => {
    expect(classifyFailure(ApiError.internal())).toBe(FailureCategory.RUNTIME_ERROR);
  });

  it('classifies an unrecognized error as UNKNOWN_ERROR — never guesses in the AI\'s favor', () => {
    expect(classifyFailure(new Error('something weird'))).toBe(FailureCategory.UNKNOWN_ERROR);
    expect(classifyFailure('not even an Error')).toBe(FailureCategory.UNKNOWN_ERROR);
  });
});

describe('isRetryable', () => {
  it('only AI_ERROR/TIMEOUT/RUNTIME_ERROR are retryable', () => {
    expect(isRetryable(FailureCategory.AI_ERROR)).toBe(true);
    expect(isRetryable(FailureCategory.TIMEOUT)).toBe(true);
    expect(isRetryable(FailureCategory.RUNTIME_ERROR)).toBe(true);
  });

  it('validation/security/dependency/authorization failures are never retryable', () => {
    expect(isRetryable(FailureCategory.VALIDATION_ERROR)).toBe(false);
    expect(isRetryable(FailureCategory.SECURITY_ERROR)).toBe(false);
    expect(isRetryable(FailureCategory.DEPENDENCY_ERROR)).toBe(false);
    expect(isRetryable(FailureCategory.AUTHORIZATION_ERROR)).toBe(false);
    expect(isRetryable(FailureCategory.FILE_CONFLICT)).toBe(false);
    expect(isRetryable(FailureCategory.UNKNOWN_ERROR)).toBe(false);
  });
});

describe('shouldRetry', () => {
  it('retries a transient failure under the MAX_RETRIES cap', () => {
    expect(shouldRetry(FailureCategory.TIMEOUT, 0)).toBe(true);
    expect(shouldRetry(FailureCategory.TIMEOUT, 1)).toBe(true);
  });

  it('stops retrying once MAX_RETRIES (2) attempts have already happened', () => {
    expect(shouldRetry(FailureCategory.TIMEOUT, 2)).toBe(false);
  });

  it('never retries a non-transient category regardless of attempt count', () => {
    expect(shouldRetry(FailureCategory.VALIDATION_ERROR, 0)).toBe(false);
  });
});
