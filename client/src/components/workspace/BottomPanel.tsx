'use client';

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TerminalPanel } from '@/components/terminal/TerminalPanel';
import type { EditorProblem } from '@/types/workspace';

interface BottomPanelProps {
  projectId: string;
  problems: EditorProblem[];
  logs: string[];
  onSelectProblem: (filePath: string, line: number) => void;
}

const SEVERITY_ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const SEVERITY_COLOR = {
  error: 'text-destructive',
  warning: 'text-amber-500',
  info: 'text-muted-foreground',
} as const;

export function BottomPanel({ projectId, problems, logs, onSelectProblem }: BottomPanelProps) {
  return (
    <Tabs defaultValue="problems" className="flex h-full flex-col gap-0">
      <TabsList className="h-9 w-fit shrink-0 rounded-none border-b border-border bg-transparent p-0">
        <TabsTrigger value="output" className="rounded-none data-[state=active]:shadow-none">
          Output
        </TabsTrigger>
        <TabsTrigger value="problems" className="rounded-none data-[state=active]:shadow-none">
          Problems{problems.length > 0 && <span className="ml-1 text-muted-foreground">({problems.length})</span>}
        </TabsTrigger>
        <TabsTrigger value="logs" className="rounded-none data-[state=active]:shadow-none">
          Logs
        </TabsTrigger>
        <TabsTrigger value="terminal" className="rounded-none data-[state=active]:shadow-none">
          Terminal
        </TabsTrigger>
      </TabsList>

      <TabsContent value="output" className="flex-1 overflow-y-auto p-3 text-sm text-muted-foreground">
        No output yet.
      </TabsContent>

      <TabsContent value="problems" className="flex-1 overflow-y-auto p-1">
        {problems.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No problems detected.</p>
        ) : (
          problems.map((problem, index) => {
            const Icon = SEVERITY_ICON[problem.severity];
            return (
              <button
                key={`${problem.filePath}-${problem.line}-${index}`}
                type="button"
                onClick={() => onSelectProblem(problem.filePath, problem.line)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50"
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${SEVERITY_COLOR[problem.severity]}`} />
                <span className="min-w-0 flex-1 truncate">{problem.message}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {problem.filePath}:{problem.line}
                </span>
              </button>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="logs" className="flex-1 overflow-y-auto p-3 font-mono text-xs text-muted-foreground">
        {logs.length === 0 ? 'No logs yet.' : logs.map((log, index) => <div key={index}>{log}</div>)}
      </TabsContent>

      <TabsContent value="terminal" className="flex-1 overflow-hidden">
        <TerminalPanel projectId={projectId} />
      </TabsContent>
    </Tabs>
  );
}
