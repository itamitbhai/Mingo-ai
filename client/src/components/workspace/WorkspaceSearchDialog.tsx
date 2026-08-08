'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as fileService from '@/services/files/file.service';
import type { FileSearchResult } from '@/types/workspace';

interface WorkspaceSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSelect: (path: string) => void;
}

export function WorkspaceSearchDialog({
  open,
  onOpenChange,
  projectId,
  onSelect,
}: WorkspaceSearchDialogProps) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const token = await getToken();
        const data = await fileService.searchFiles(projectId, trimmed, token);
        if (!cancelled) setResults(data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, projectId, getToken]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Workspace"
      description="Search across all project files"
      shouldFilter={false}
    >
      <CommandInput placeholder="Search file contents..." value={query} onValueChange={setQuery} />
      <CommandList>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Searching...
          </div>
        )}
        {!isLoading && debouncedQuery.trim() && results.length === 0 && (
          <CommandEmpty>No matches found.</CommandEmpty>
        )}
        {!isLoading &&
          results.map((result) => (
            <CommandGroup key={result.path} heading={result.path}>
              {result.matches.map((match) => (
                <CommandItem
                  key={`${result.path}-${match.line}`}
                  value={`${result.path}-${match.line}`}
                  onSelect={() => {
                    onSelect(result.path);
                    onOpenChange(false);
                  }}
                >
                  <span className="shrink-0 text-xs text-muted-foreground">L{match.line}</span>
                  <span className="truncate font-mono text-xs">{match.snippet}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
      </CommandList>
    </CommandDialog>
  );
}
