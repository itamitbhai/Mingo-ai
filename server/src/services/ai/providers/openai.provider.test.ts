import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();

vi.mock('openai', () => {
  class MockAPIError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  class MockOpenAI {
    chat = { completions: { create: createMock } };
    static APIError = MockAPIError;
  }
  return { default: MockOpenAI };
});

vi.mock('../../../config/env', () => ({
  env: { OPENAI_API_KEY: 'test-key' },
}));

import OpenAI from 'openai';
import { openaiProvider } from './openai.provider';

describe('openaiProvider.complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests a non-streaming json_object completion', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
    });

    const result = await openaiProvider.complete({
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'usr' },
      ],
      model: 'gpt-4o-mini',
      signal: new AbortController().signal,
      responseFormat: 'json_object',
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        stream: false,
        response_format: { type: 'json_object' },
      }),
      expect.anything()
    );
    expect(result).toEqual({
      content: '{"ok":true}',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
    });
  });

  it('returns null usage fields when the provider omits them', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: '{}' } }] });

    const result = await openaiProvider.complete({
      messages: [],
      model: 'gpt-4o-mini',
      signal: new AbortController().signal,
      responseFormat: 'json_object',
    });

    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null });
  });

  it('normalizes a 429 response into a rate_limit AIProviderError', async () => {
    const ApiErrorCtor = (OpenAI as unknown as { APIError: new (message: string, status: number) => Error })
      .APIError;
    createMock.mockRejectedValue(new ApiErrorCtor('rate limited', 429));

    await expect(
      openaiProvider.complete({
        messages: [],
        model: 'gpt-4o-mini',
        signal: new AbortController().signal,
        responseFormat: 'json_object',
      })
    ).rejects.toMatchObject({ code: 'rate_limit' });
  });

  it('normalizes a 500 response into an unavailable AIProviderError', async () => {
    const ApiErrorCtor = (OpenAI as unknown as { APIError: new (message: string, status: number) => Error })
      .APIError;
    createMock.mockRejectedValue(new ApiErrorCtor('server error', 500));

    await expect(
      openaiProvider.complete({
        messages: [],
        model: 'gpt-4o-mini',
        signal: new AbortController().signal,
        responseFormat: 'json_object',
      })
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('rethrows the abort error as-is when the signal was already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    createMock.mockRejectedValue(abortError);

    await expect(
      openaiProvider.complete({
        messages: [],
        model: 'gpt-4o-mini',
        signal: controller.signal,
        responseFormat: 'json_object',
      })
    ).rejects.toBe(abortError);
  });
});
