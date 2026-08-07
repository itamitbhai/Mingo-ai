'use client';

import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { createProjectSchema, type CreateProjectInput } from 'shared';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import {
  AUTH_OPTIONS,
  BACKEND_OPTIONS,
  DATABASE_OPTIONS,
  DEPLOYMENT_OPTIONS,
  FRONTEND_OPTIONS,
  STYLING_OPTIONS,
} from '@/utils/tech-stack';

type SelectFieldName =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'authentication'
  | 'styling'
  | 'deployment';

function TechSelectField({
  control,
  name,
  label,
  options,
  error,
}: {
  control: Control<CreateProjectInput>;
  name: SelectFieldName;
  label: string;
  options: readonly string[];
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id={name} className="w-full">
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface ProjectFormProps {
  defaultValues: CreateProjectInput;
  onSubmit: (data: CreateProjectInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

export function ProjectForm({ defaultValues, onSubmit, onCancel, submitLabel }: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues,
  });

  const internalSubmit = async (data: CreateProjectInput) => {
    try {
      await onSubmit(data);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          setError(field as keyof CreateProjectInput, { message: messages[0] });
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(internalSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" placeholder="e.g. Acme Dashboard" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="What is this project about?"
          rows={3}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TechSelectField
          control={control}
          name="frontend"
          label="Frontend"
          options={FRONTEND_OPTIONS}
          error={errors.frontend?.message}
        />
        <TechSelectField
          control={control}
          name="backend"
          label="Backend"
          options={BACKEND_OPTIONS}
          error={errors.backend?.message}
        />
        <TechSelectField
          control={control}
          name="database"
          label="Database"
          options={DATABASE_OPTIONS}
          error={errors.database?.message}
        />
        <TechSelectField
          control={control}
          name="authentication"
          label="Authentication"
          options={AUTH_OPTIONS}
          error={errors.authentication?.message}
        />
        <TechSelectField
          control={control}
          name="styling"
          label="Styling"
          options={STYLING_OPTIONS}
          error={errors.styling?.message}
        />
        <TechSelectField
          control={control}
          name="deployment"
          label="Deployment"
          options={DEPLOYMENT_OPTIONS}
          error={errors.deployment?.message}
        />
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
