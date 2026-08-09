'use client';

import { useState } from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import type { IPlanTask, TaskPriority } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const PRIORITY_VARIANT: Record<TaskPriority, 'destructive' | 'warning' | 'default' | 'outline'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'default',
  low: 'outline',
};

interface TaskListProps {
  tasks: IPlanTask[] | undefined;
  executionOrder: string[] | undefined;
  editable?: boolean;
  onEdit?: (edit: { id: string; title?: string; description?: string; acceptanceCriteria?: string[] }) => void;
}

export function TaskList({ tasks, executionOrder, editable = false, onEdit }: TaskListProps) {
  const [editing, setEditing] = useState<IPlanTask | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState('');

  if (!tasks || tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tasks were generated.</p>;
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));

  function openEdit(task: IPlanTask) {
    setEditing(task);
    setTitle(task.title);
    setDescription(task.description);
    setCriteria(task.acceptanceCriteria.join('\n'));
  }

  function handleSave() {
    if (!editing) return;
    onEdit?.({
      id: editing.id,
      title,
      description,
      acceptanceCriteria: criteria
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    });
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {executionOrder && executionOrder.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 p-3 text-xs">
          <span className="mr-1 font-medium text-muted-foreground">Execution order:</span>
          {executionOrder.map((id, index) => (
            <span key={id} className="flex items-center gap-1.5">
              <span className="font-mono">{taskById.get(id)?.id ?? id}</span>
              {index < executionOrder.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <Card key={task.id} className="bg-card/60">
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{task.id}</span>
                  <span className="text-sm font-semibold">{task.title}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={PRIORITY_VARIANT[task.priority]} className="capitalize">
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {task.type}
                  </Badge>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={`Edit ${task.title}`}
                      onClick={() => openEdit(task)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{task.description}</p>

              {task.dependencies.length > 0 && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Depends on: </span>
                  {task.dependencies.map((depId, index) => (
                    <span key={depId} className="font-mono">
                      {depId}
                      {index < task.dependencies.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </p>
              )}

              {task.acceptanceCriteria.length > 0 && (
                <ul className="flex flex-col gap-1 text-xs">
                  {task.acceptanceCriteria.map((criterion, index) => (
                    <li key={index} className="flex gap-1.5">
                      <span aria-hidden>✓</span>
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              )}

              {task.recommendedAgent && (
                <Badge variant="outline" className="w-fit capitalize">
                  Recommended agent: {task.recommendedAgent}
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task title" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              aria-label="Task description"
            />
            <Textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              rows={4}
              placeholder="One acceptance criterion per line"
              aria-label="Acceptance criteria"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
