'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { IConversation } from 'shared';

import { ApiError } from '@/lib/api';
import * as conversationService from '@/services/conversation.service';

export function useConversations(projectId: string, initialConversations: IConversation[]) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<IConversation[]>(initialConversations);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function upsert(conversation: IConversation) {
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === conversation.id);
      const next = exists
        ? prev.map((c) => (c.id === conversation.id ? conversation : c))
        : [conversation, ...prev];
      return [...next].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }

  async function create(title?: string) {
    try {
      const token = await getToken();
      const conversation = await conversationService.createConversation(projectId, { title }, token);
      upsert(conversation);
      return conversation;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to create conversation');
      return null;
    }
  }

  async function rename(id: string, title: string) {
    setPendingId(id);
    try {
      const token = await getToken();
      const updated = await conversationService.renameConversation(id, { title }, token);
      upsert(updated);
      toast.success('Conversation renamed');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to rename conversation');
    } finally {
      setPendingId(null);
    }
  }

  async function remove(id: string, options?: { redirectTo?: string }) {
    setPendingId(id);
    try {
      const token = await getToken();
      await conversationService.deleteConversation(id, token);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      toast.success('Conversation deleted');
      if (options?.redirectTo) {
        router.push(options.redirectTo);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete conversation');
    } finally {
      setPendingId(null);
    }
  }

  async function refresh(id: string) {
    try {
      const token = await getToken();
      const conversation = await conversationService.getConversation(id, token);
      upsert(conversation);
    } catch {
      // Best-effort refresh (e.g. after the first message sets a title) — safe to ignore.
    }
  }

  return { conversations, pendingId, create, rename, remove, refresh, upsert };
}
