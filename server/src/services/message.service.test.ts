import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../models', () => ({
  MessageModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findById: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

import { MessageModel } from '../models';
import * as messageService from './message.service';

describe('message.service', () => {
  const conversationId = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resetAssistantMessageForRetry', () => {
    it('throws a 404 when the target message does not exist in this conversation', async () => {
      vi.mocked(MessageModel.findOneAndUpdate).mockResolvedValue(null);

      await expect(
        messageService.resetAssistantMessageForRetry(conversationId, 'missing-id')
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('resets the existing assistant message in place instead of creating a new one', async () => {
      const reset = { _id: new Types.ObjectId(), status: 'pending', content: '' };
      vi.mocked(MessageModel.findOneAndUpdate).mockResolvedValue(reset as never);

      const result = await messageService.resetAssistantMessageForRetry(conversationId, 'm1');

      expect(MessageModel.create).not.toHaveBeenCalled();
      expect(result).toBe(reset);
    });
  });

  describe('findPrecedingUserMessage', () => {
    it('throws a 404 when there is no earlier user message to retry from', async () => {
      vi.mocked(MessageModel.findOne).mockReturnValue({
        sort: vi.fn().mockResolvedValue(null),
      } as never);

      await expect(
        messageService.findPrecedingUserMessage(conversationId, new Types.ObjectId())
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('listMessages', () => {
    it('reports hasMore and returns the page oldest-first when more messages exist', async () => {
      const docs = Array.from({ length: 4 }, () => ({ _id: new Types.ObjectId() }));
      const limitMock = vi.fn().mockResolvedValue(docs);
      const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
      vi.mocked(MessageModel.find).mockReturnValue({ sort: sortMock } as never);

      const result = await messageService.listMessages(conversationId, { limit: 3 });

      expect(limitMock).toHaveBeenCalledWith(4);
      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBe(result.items[0]._id.toString());
    });

    it('reports hasMore as false when fewer messages exist than the limit', async () => {
      const docs = [{ _id: new Types.ObjectId() }, { _id: new Types.ObjectId() }];
      const limitMock = vi.fn().mockResolvedValue(docs);
      const sortMock = vi.fn().mockReturnValue({ limit: limitMock });
      vi.mocked(MessageModel.find).mockReturnValue({ sort: sortMock } as never);

      const result = await messageService.listMessages(conversationId, { limit: 30 });

      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(2);
    });
  });
});
