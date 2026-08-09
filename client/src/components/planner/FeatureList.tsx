'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { IPlanFeature, TaskPriority } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const PRIORITY_VARIANT: Record<TaskPriority, 'destructive' | 'warning' | 'default' | 'outline'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'default',
  low: 'outline',
};

const PRIORITIES: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

interface FeatureListProps {
  features: IPlanFeature[] | undefined;
  editable?: boolean;
  onEdit?: (edit: { id: string; title?: string; description?: string; priority?: TaskPriority }) => void;
}

export function FeatureList({ features, editable = false, onEdit }: FeatureListProps) {
  const [editing, setEditing] = useState<IPlanFeature | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  if (!features || features.length === 0) {
    return <p className="text-sm text-muted-foreground">No features were generated.</p>;
  }

  function openEdit(feature: IPlanFeature) {
    setEditing(feature);
    setTitle(feature.name);
    setDescription(feature.description);
    setPriority(feature.priority);
  }

  function handleSave() {
    if (!editing) return;
    onEdit?.({ id: editing.id, title, description, priority });
    setEditing(null);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {features.map((feature) => (
          <Card key={feature.id} className="bg-card/60">
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold">{feature.name}</span>
                <div className="flex items-center gap-1.5">
                  <Badge variant={PRIORITY_VARIANT[feature.priority]} className="capitalize">
                    {feature.priority}
                  </Badge>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={`Edit ${feature.name}`}
                      onClick={() => openEdit(feature)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="capitalize">
                  {feature.complexity}
                </Badge>
                {feature.requirements.map((req, index) => (
                  <Badge key={index} variant="outline">
                    {req}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit feature</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Feature title" />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              aria-label="Feature description"
            />
            <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
              <SelectTrigger aria-label="Priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
