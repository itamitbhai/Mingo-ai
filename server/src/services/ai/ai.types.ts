export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export type StreamChunk = { type: 'delta'; content: string } | { type: 'usage'; usage: TokenUsage };

export interface StreamChatParams {
  messages: ChatMessage[];
  model: string;
  signal: AbortSignal;
}

export interface AIProviderAdapter {
  readonly name: string;
  streamChat(params: StreamChatParams): AsyncGenerator<StreamChunk>;
}

export type AIErrorCode = 'not_configured' | 'auth' | 'rate_limit' | 'unavailable' | 'timeout' | 'unknown';

export class AIProviderError extends Error {
  public readonly code: AIErrorCode;
  public readonly cause?: unknown;

  constructor(code: AIErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.cause = cause;
  }
}
