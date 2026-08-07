'use client';

import { Plus } from 'lucide-react';
import type { CreateProjectInput } from 'shared';

import { Button } from '@/components/ui/button';
import { useCreateProjectStore } from '@/store/use-create-project-store';

interface NewProjectButtonProps {
  label?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  prefill?: Partial<CreateProjectInput>;
}

export function NewProjectButton({
  label = 'New Project',
  variant = 'default',
  size = 'default',
  className,
  prefill,
}: NewProjectButtonProps) {
  const open = useCreateProjectStore((state) => state.open);

  return (
    <Button variant={variant} size={size} className={className} onClick={() => open(prefill)}>
      <Plus className="size-4" />
      {label}
    </Button>
  );
}
