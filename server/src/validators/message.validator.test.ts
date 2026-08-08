import { describe, expect, it } from 'vitest';
import { messageQuerySchema, sendMessageSchema, updateConversationSchema } from '../validators';

const VALID_OBJECT_ID = '507f1f77bcf86cd799439011';

describe('sendMessageSchema', () => {
  it('accepts a message with only content', () => {
    expect(sendMessageSchema.safeParse({ content: 'Hi there' }).success).toBe(true);
  });

  it('accepts a retry with only retryMessageId', () => {
    expect(sendMessageSchema.safeParse({ retryMessageId: VALID_OBJECT_ID }).success).toBe(true);
  });

  it('rejects when both content and retryMessageId are provided', () => {
    expect(
      sendMessageSchema.safeParse({ content: 'Hi', retryMessageId: VALID_OBJECT_ID }).success
    ).toBe(false);
  });

  it('rejects when neither content nor retryMessageId is provided', () => {
    expect(sendMessageSchema.safeParse({}).success).toBe(false);
  });

  it('rejects content over the max length', () => {
    expect(sendMessageSchema.safeParse({ content: 'a'.repeat(8001) }).success).toBe(false);
  });

  it('rejects an empty content string', () => {
    expect(sendMessageSchema.safeParse({ content: '   ' }).success).toBe(false);
  });
});

describe('messageQuerySchema', () => {
  it('defaults limit to 30 when omitted', () => {
    const result = messageQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(30);
    }
  });

  it('rejects a limit above 50', () => {
    expect(messageQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('rejects a malformed cursor', () => {
    expect(messageQuerySchema.safeParse({ cursor: 'not-an-object-id' }).success).toBe(false);
  });
});

describe('updateConversationSchema', () => {
  it('requires a non-empty title', () => {
    expect(updateConversationSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('rejects a title over 80 characters', () => {
    expect(updateConversationSchema.safeParse({ title: 'a'.repeat(81) }).success).toBe(false);
  });

  it('accepts a valid title', () => {
    expect(updateConversationSchema.safeParse({ title: 'JWT Authentication Setup' }).success).toBe(
      true
    );
  });
});
