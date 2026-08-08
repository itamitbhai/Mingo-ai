'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { IConversation } from 'shared';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/format';

interface ConversationListItemProps {
  projectId: string;
  conversation: IConversation;
  isActive: boolean;
  isPending: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationListItem({
  projectId,
  conversation,
  isActive,
  isPending,
  onRename,
  onDelete,
}: ConversationListItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleRenameSubmit() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(conversation.id, trimmed);
    }
    setIsRenaming(false);
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-lg px-1 py-0.5 transition-colors',
        isActive ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      <Link href={`/projects/${projectId}/chat/${conversation.id}`} className="min-w-0 flex-1 px-1.5 py-1.5">
        <p className="truncate text-sm font-medium">{conversation.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatRelativeTime(conversation.lastMessageAt ?? conversation.updatedAt)}
        </p>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="Conversation options"
            disabled={isPending}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setTitle(conversation.title);
              setIsRenaming(true);
            }}
          >
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isRenaming} onOpenChange={setIsRenaming}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleRenameSubmit();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenaming(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{conversation.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the conversation and its messages. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(conversation.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
