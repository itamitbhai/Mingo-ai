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

export interface CompleteParams {
  messages: ChatMessage[];
  model: string;
  signal: AbortSignal;
  /** 'json_object' asks the provider to guarantee syntactically valid JSON output — used by the
   *  Planner Agent, which needs one structured response rather than a token stream. */
  responseFormat: 'json_object';
}

export interface CompleteResult {
  content: string;
  usage: TokenUsage;
}

export interface AIProviderAdapter {
  readonly name: string;
  streamChat(params: StreamChatParams): AsyncGenerator<StreamChunk>;
  complete(params: CompleteParams): Promise<CompleteResult>;
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
