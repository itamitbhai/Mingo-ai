import { Request, Response } from 'express';
import { MessageQueryInput, MessageStatus, SendMessageInput } from 'shared';
import { MessageDocument } from '../models';
import * as aiService from '../services/ai/ai.service';
import { ChatMessage } from '../services/ai/ai.types';
import { ProjectContext } from '../services/ai/prompts/system.prompt';
import * as conversationService from '../services/conversation.service';
import * as messageService from '../services/message.service';
import * as projectService from '../services/project.service';
import * as usageService from '../services/usage.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';
import { logger } from '../utils/logger';

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const conversation = await conversationService.getConversationById(
    user._id,
    req.params.conversationId
  );

  const query = req.query as unknown as MessageQueryInput;
  const result = await messageService.listMessages(conversation._id, query);
  sendSuccess(res, result);
});

export const postMessage = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const conversation = await conversationService.getConversationById(
    user._id,
    req.params.conversationId
  );
  const project = await projectService.getProjectById(user._id, conversation.project.toString());
  const body = req.body as SendMessageInput;

  let userMessageForHistory: MessageDocument | null = null;
  let assistantMessage: MessageDocument;

  if (body.content) {
    const userMessage = await messageService.createUserMessage(
      conversation._id,
      conversation.project,
      body.content
    );
    userMessageForHistory = userMessage;

    const userMessageCount = await messageService.countUserMessages(conversation._id);
    const title = userMessageCount === 1 ? aiService.generateConversationTitle(body.content) : undefined;
    await conversationService.touchConversation(conversation._id, title);

    assistantMessage = await messageService.createAssistantPlaceholder(
      conversation._id,
      conversation.project
    );
  } else if (body.retryMessageId) {
    assistantMessage = await messageService.resetAssistantMessageForRetry(
      conversation._id,
      body.retryMessageId
    );
    userMessageForHistory = await messageService.findPrecedingUserMessage(
      conversation._id,
      assistantMessage._id
    );
    await conversationService.touchConversation(conversation._id);
  } else {
    throw ApiError.badRequest('Provide either "content" or "retryMessageId"');
  }

  const { items: recentMessages } = await messageService.listMessages(conversation._id, {
    limit: aiService.HISTORY_WINDOW,
  });

  const history: ChatMessage[] = recentMessages
    .filter(
      (message) =>
        message._id.toString() !== assistantMessage._id.toString() &&
        message.status !== MessageStatus.FAILED &&
        message.status !== MessageStatus.CANCELLED
    )
    .map((message) => ({ role: message.role, content: message.content }));

  const projectContext: ProjectContext = {
    projectId: project._id.toString(),
    projectName: project.name,
    description: project.description,
    frontend: project.frontend,
    backend: project.backend,
    database: project.database,
    authentication: project.authentication,
    styling: project.styling,
    deployment: project.deployment,
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const write = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  if (userMessageForHistory) {
    write({ type: 'user_message', message: userMessageForHistory });
  }
  write({ type: 'assistant_start', message: assistantMessage });

  const controller = new AbortController();
  let clientClosed = false;
  res.on('close', () => {
    clientClosed = true;
    controller.abort();
  });

  const logContext = {
    conversationId: conversation.id,
    projectId: project.id,
    userId: user.id,
    messageId: assistantMessage.id,
  };

  logger.info('ai.request.started', logContext);

  let buffer = '';
  let lastPersistedAt = Date.now();
  let usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | undefined;
  const PERSIST_INTERVAL_MS = 250;

  try {
    for await (const chunk of aiService.generateReply({
      projectContext,
      history,
      signal: controller.signal,
    })) {
      if (chunk.type === 'delta') {
        buffer += chunk.content;
        write({ type: 'delta', content: chunk.content });

        if (Date.now() - lastPersistedAt > PERSIST_INTERVAL_MS) {
          lastPersistedAt = Date.now();
          await messageService.updateMessageContent(assistantMessage._id, buffer, MessageStatus.STREAMING);
        }
      } else if (chunk.type === 'usage') {
        usage = chunk.usage;
      }
    }

    const finalMessage = await messageService.finalizeMessage(assistantMessage._id, {
      content: buffer,
      status: MessageStatus.COMPLETED,
      provider: aiService.getProviderName(),
      modelName: aiService.getModelName(),
      tokens: {
        input: usage?.inputTokens ?? null,
        output: usage?.outputTokens ?? null,
        total: usage?.totalTokens ?? null,
      },
    });

    await usageService.recordUsage({
      userId: user._id,
      projectId: project._id,
      conversationId: conversation._id,
      modelName: aiService.getModelName(),
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
    });

    logger.info('ai.request.completed', logContext);

    write({ type: 'done', message: finalMessage });
    res.end();
  } catch (err) {
    if (clientClosed) {
      await messageService.updateMessageContent(assistantMessage._id, buffer, MessageStatus.CANCELLED);
      logger.info('ai.request.cancelled', logContext);
      return;
    }

    logger.error('ai.request.failed', err);
    await messageService.finalizeMessage(assistantMessage._id, {
      content: buffer,
      status: MessageStatus.FAILED,
    });

    write({ type: 'error', message: aiService.describeAIError(err), messageId: assistantMessage.id });
    res.end();
  }
});
