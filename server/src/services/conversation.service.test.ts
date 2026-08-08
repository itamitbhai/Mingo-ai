import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

vi.mock('../models', () => ({
  ConversationModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
  MessageModel: {
    deleteMany: vi.fn(),
  },
}));

vi.mock('./project.service', () => ({
  getProjectById: vi.fn(),
}));

import { ConversationModel, MessageModel } from '../models';
import * as projectService from './project.service';
import * as conversationService from './conversation.service';

describe('conversation.service', () => {
  const owner = new Types.ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConversationById', () => {
    it('throws a 404 when the conversation does not belong to the caller', async () => {
      vi.mocked(ConversationModel.findOne).mockResolvedValue(null);

      await expect(conversationService.getConversationById(owner, 'abc')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('returns the conversation when it is owned by the caller', async () => {
      const doc = { _id: new Types.ObjectId(), owner };
      vi.mocked(ConversationModel.findOne).mockResolvedValue(doc);

      await expect(conversationService.getConversationById(owner, 'abc')).resolves.toBe(doc);
    });
  });

  describe('createConversation', () => {
    it('verifies project ownership before creating the conversation', async () => {
      vi.mocked(projectService.getProjectById).mockResolvedValue({ _id: 'p1' } as never);
      vi.mocked(ConversationModel.create).mockResolvedValue({ id: 'c1' } as never);

      await conversationService.createConversation(owner, 'p1', { title: 'Hello' });

      expect(projectService.getProjectById).toHaveBeenCalledWith(owner, 'p1');
      expect(ConversationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ project: 'p1', owner, title: 'Hello' })
      );
    });

    it('never creates a conversation for a project the caller does not own', async () => {
      vi.mocked(projectService.getProjectById).mockRejectedValue(
        Object.assign(new Error('Project not found'), { statusCode: 404 })
      );

      await expect(
        conversationService.createConversation(owner, 'p1', {})
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(ConversationModel.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteConversation', () => {
    it('cascades deletion to the conversation’s messages', async () => {
      const doc = {
        _id: new Types.ObjectId(),
        owner,
        deleteOne: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(ConversationModel.findOne).mockResolvedValue(doc);
      vi.mocked(MessageModel.deleteMany).mockResolvedValue({ deletedCount: 3 } as never);

      await conversationService.deleteConversation(owner, doc._id.toString());

      expect(MessageModel.deleteMany).toHaveBeenCalledWith({ conversation: doc._id });
      expect(doc.deleteOne).toHaveBeenCalledTimes(1);
    });
  });
});
