import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { env } from '../../../config/env';
import { AIProviderAdapter, AIProviderError, ChatMessage, StreamChatParams, StreamChunk } from '../ai.types';

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new AIProviderError('not_configured', 'The AI provider is not configured.');
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return cachedClient;
}

function toOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((message) => ({ role: message.role, content: message.content }) as ChatCompletionMessageParam);
}

function normalizeError(err: unknown): AIProviderError {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 401 || err.status === 403) {
      return new AIProviderError('auth', 'The AI provider rejected the request (invalid API key).', err);
    }
    if (err.status === 429) {
      return new AIProviderError('rate_limit', 'The AI provider is rate-limiting requests.', err);
    }
    if (err.status && err.status >= 500) {
      return new AIProviderError('unavailable', 'The AI provider is temporarily unavailable.', err);
    }
  }

  if (err instanceof Error && /timeout/i.test(err.name)) {
    return new AIProviderError('timeout', 'The AI provider timed out.', err);
  }

  return new AIProviderError('unknown', 'The AI provider returned an unexpected error.', err);
}

async function* streamChat({ messages, model, signal }: StreamChatParams): AsyncGenerator<StreamChunk> {
  const client = getClient();

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages: toOpenAIMessages(messages),
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal }
    );

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;

      if (delta) {
        yield { type: 'delta', content: delta };
      }

      if (chunk.usage) {
        yield {
          type: 'usage',
          usage: {
            inputTokens: chunk.usage.prompt_tokens ?? null,
            outputTokens: chunk.usage.completion_tokens ?? null,
            totalTokens: chunk.usage.total_tokens ?? null,
          },
        };
      }
    }
  } catch (err) {
    if (signal.aborted) {
      throw err;
    }
    throw normalizeError(err);
  }
}

export const openaiProvider: AIProviderAdapter = {
  name: 'openai',
  streamChat,
};
