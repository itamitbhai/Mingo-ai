'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { IConversation } from 'shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ConversationListItem } from './ConversationListItem';

interface ChatSidebarProps {
  projectId: string;
  conversations: IConversation[];
  activeConversationId: string | null;
  pendingId: string | null;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function groupByDay(conversations: IConversation[]): [string, IConversation[]][] {
  const groups = new Map<string, IConversation[]>();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  for (const conversation of conversations) {
    const time = new Date(conversation.lastMessageAt ?? conversation.updatedAt).getTime();
    const label = time >= startOfToday ? 'Today' : time >= startOfYesterday ? 'Yesterday' : 'Earlier';
    const bucket = groups.get(label) ?? [];
    bucket.push(conversation);
    groups.set(label, bucket);
  }

  return Array.from(groups.entries());
}

export function ChatSidebar({
  projectId,
  conversations,
  activeConversationId,
  pendingId,
  onNewChat,
  onRename,
  onDelete,
}: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(query));
  }, [conversations, debouncedSearch]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <Button className="w-full justify-center" size="sm" onClick={onNewChat}>
          <Plus className="size-4" /> New Chat
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            className="h-8 pl-8 text-xs"
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        {groups.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No conversations yet</p>
        )}
        {groups.map(([label, items]) => (
          <div key={label} className="space-y-1">
            <p className="px-2 text-xs font-medium text-muted-foreground">{label}</p>
            {items.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                projectId={projectId}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                isPending={pendingId === conversation.id}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
