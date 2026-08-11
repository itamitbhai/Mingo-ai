import { AIProvider as AIProviderEnum } from 'shared';
import { env } from '../../config/env';
import { openaiProvider } from './providers/openai.provider';
import { buildSystemPrompt, ProjectContext } from './prompts/system.prompt';
import { AIProviderAdapter, AIProviderError, ChatMessage, CompleteResult, StreamChunk } from './ai.types';

export const HISTORY_WINDOW = 20;
export const TITLE_MAX_LENGTH = 60;

const providers: Partial<Record<string, AIProviderAdapter>> = {
  [AIProviderEnum.OPENAI]: openaiProvider,
};

function getProvider(): AIProviderAdapter {
  const provider = providers[env.AI_PROVIDER];

  if (!provider) {
    throw new AIProviderError('not_configured', `Unsupported AI provider: ${env.AI_PROVIDER}`);
  }

  return provider;
}

export interface GenerateReplyParams {
  projectContext: ProjectContext;
  history: ChatMessage[];
  signal: AbortSignal;
}

export async function* generateReply({
  projectContext,
  history,
  signal,
}: GenerateReplyParams): AsyncGenerator<StreamChunk> {
  const provider = getProvider();
  const systemPrompt = buildSystemPrompt(projectContext);
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...history];

  yield* provider.streamChat({ messages, model: env.AI_MODEL, signal });
}

export interface GenerateStructuredParams {
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
  /** Overrides `env.AI_MODEL` — used by the Frontend Agent's `FRONTEND_AGENT_MODEL`. */
  model?: string;
  maxOutputTokens?: number;
}

/**
 * One non-streamed, JSON-mode completion — used by the Planner and Frontend Agents, which need a
 * single reliable structured response rather than a token stream. Goes through the same provider
 * abstraction as `generateReply`; callers (agents) never talk to a provider or OpenAI directly.
 */
export async function generateStructuredCompletion({
  systemPrompt,
  userPrompt,
  signal,
  model,
  maxOutputTokens,
}: GenerateStructuredParams): Promise<CompleteResult> {
  const provider = getProvider();
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  return provider.complete({
    messages,
    model: model ?? env.AI_MODEL,
    signal,
    responseFormat: 'json_object',
    maxOutputTokens,
  });
}

export function getModelName(): string {
  return env.AI_MODEL;
}

export function getProviderName(): string {
  return env.AI_PROVIDER;
}

export function describeAIError(err: unknown): string {
  if (err instanceof AIProviderError) {
    switch (err.code) {
      case 'not_configured':
        return 'The AI assistant is not configured yet. Please add an API key and try again.';
      case 'auth':
        return 'The AI assistant is not configured correctly. Please contact support.';
      case 'rate_limit':
        return 'The AI is receiving too many requests right now. Please try again in a moment.';
      case 'unavailable':
        return 'The AI provider is temporarily unavailable. Please try again shortly.';
      case 'timeout':
        return 'The request to the AI took too long. Please try again.';
      default:
        return 'Something went wrong while generating the response. Please try again.';
    }
  }

  return 'Something went wrong while generating the response. Please try again.';
}

/** Deterministic title from the first user message — no extra AI call (spec section 18). */
export function generateConversationTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\s+/g, ' ');

  if (cleaned.length <= TITLE_MAX_LENGTH) {
    return cleaned;
  }

  return `${cleaned.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`;
}
