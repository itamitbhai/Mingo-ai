import type { IMessage } from 'shared';

export interface MessagePage {
  items: IMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

export type StreamEvent =
  | { type: 'user_message'; message: IMessage }
  | { type: 'assistant_start'; message: IMessage }
  | { type: 'delta'; content: string }
  | { type: 'done'; message: IMessage }
  | { type: 'error'; message: string; messageId?: string };

export interface StreamMessageBody {
  content?: string;
  retryMessageId?: string;
}
