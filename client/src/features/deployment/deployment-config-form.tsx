'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  DeploymentEnvironment,
  DeploymentOption,
  DeploymentServiceType,
  deploymentConfigSchema,
  type DeploymentConfigInput,
} from 'shared';

/** `deploymentConfigSchema` has both `.default()` fields and a top-level `.refine()`, so its zod
 *  *input* shape (optional fields, pre-default) differs from `DeploymentConfigInput`
 *  (`z.infer`, the post-parse output `zodResolver` actually returns to `handleSubmit` at runtime) —
 *  a well-known react-hook-form + Zod typing gap when defaults are involved. The form itself is
 *  typed against the input shape; `onSubmit` below re-parses to get the fully-defaulted output. */
type FormValues = z.input<typeof deploymentConfigSchema>;

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api';
import { getDeploymentConfig, saveDeploymentConfig } from '@/services/deployment.service';

const DEFAULT_VALUES: DeploymentConfigInput = {
  provider: DeploymentOption.RENDER,
  serviceType: DeploymentServiceType.STATIC_SITE,
  environment: DeploymentEnvironment.PRODUCTION,
  branch: 'main',
  buildCommand: 'npm run build',
  startCommand: '',
  testCommand: '',
  outputDirectory: 'dist',
  rootDirectory: '',
  framework: '',
  nodeVersion: '',
  autoDeploy: false,
  healthCheck: { path: '/', expectedStatus: 200, timeoutSeconds: 30, retries: 3 },
};

function TextField({
  control,
  name,
  label,
  placeholder,
  error,
}: {
  control: Control<FormValues>;
  name: 'branch' | 'buildCommand' | 'startCommand' | 'testCommand' | 'outputDirectory' | 'rootDirectory' | 'framework' | 'nodeVersion';
  label: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input id={name} placeholder={placeholder} {...field} value={field.value ?? ''} />
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function DeploymentConfigForm({
  projectId,
  environment,
  onSaved,
}: {
  projectId: string;
  environment: DeploymentEnvironment;
  onSaved?: () => void;
}) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(deploymentConfigSchema),
    defaultValues: { ...DEFAULT_VALUES, environment },
  });

  const serviceType = watch('serviceType');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const token = await getToken();
        const config = await getDeploymentConfig(token, projectId, environment);
        if (cancelled) return;
        reset(
          config
            ? {
                provider: config.provider,
                serviceType: config.serviceType,
                environment: config.environment,
                branch: config.branch,
                buildCommand: config.buildCommand,
                startCommand: config.startCommand ?? '',
                testCommand: config.testCommand ?? '',
                outputDirectory: config.outputDirectory ?? '',
                rootDirectory: config.rootDirectory ?? '',
                framework: config.framework ?? '',
                nodeVersion: config.nodeVersion ?? '',
                autoDeploy: config.autoDeploy,
                healthCheck: config.healthCheck,
              }
            : { ...DEFAULT_VALUES, environment }
        );
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof ApiError ? error.message : 'Failed to load deployment configuration');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, environment]);

  const onSubmit = async (data: FormValues) => {
    try {
      // zodResolver already validated `data` against `deploymentConfigSchema` before calling this
      // handler (react-hook-form just can't express that in `FormValues`'s type) — re-parsing here
      // is what actually applies the schema's defaults, not a redundant check.
      const parsed: DeploymentConfigInput = deploymentConfigSchema.parse({ ...data, environment });
      const token = await getToken();
      await saveDeploymentConfig(token, projectId, parsed);
      toast.success('Deployment configuration saved');
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to save deployment configuration');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="provider">Provider</Label>
          <Controller
            control={control}
            name="provider"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(DeploymentOption).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="serviceType">Service type</Label>
          <Controller
            control={control}
            name="serviceType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="serviceType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DeploymentServiceType.STATIC_SITE}>Static site (frontend only)</SelectItem>
                  <SelectItem value={DeploymentServiceType.WEB_SERVICE}>Web service (has a backend)</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <TextField control={control} name="branch" label="Branch" placeholder="main" error={errors.branch?.message} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name="buildCommand"
          label="Build command"
          placeholder="npm run build"
          error={errors.buildCommand?.message}
        />
        {serviceType === DeploymentServiceType.WEB_SERVICE ? (
          <TextField
            control={control}
            name="startCommand"
            label="Start command"
            placeholder="npm start"
            error={errors.startCommand?.message}
          />
        ) : (
          <TextField
            control={control}
            name="outputDirectory"
            label="Output directory"
            placeholder="dist"
            error={errors.outputDirectory?.message}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          control={control}
          name="testCommand"
          label="Test command (optional)"
          placeholder="npm test"
          error={errors.testCommand?.message}
        />
        <TextField
          control={control}
          name="rootDirectory"
          label="Root directory (optional)"
          placeholder="Leave blank for repo root"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div>
          <Label htmlFor="autoDeploy">Auto Deploy</Label>
          <p className="text-xs text-muted-foreground">Automatically deploy on every push to this branch.</p>
        </div>
        <Controller
          control={control}
          name="autoDeploy"
          render={({ field }) => (
            <Switch id="autoDeploy" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      <div className="space-y-2 rounded-lg border border-border/60 p-3">
        <Label>Health check</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="healthCheck.path" className="text-xs text-muted-foreground">
              Path
            </Label>
            <Input id="healthCheck.path" placeholder="/" {...register('healthCheck.path')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="healthCheck.expectedStatus" className="text-xs text-muted-foreground">
              Expected status
            </Label>
            <Input
              id="healthCheck.expectedStatus"
              type="number"
              {...register('healthCheck.expectedStatus', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="healthCheck.timeoutSeconds" className="text-xs text-muted-foreground">
              Timeout (s)
            </Label>
            <Input
              id="healthCheck.timeoutSeconds"
              type="number"
              {...register('healthCheck.timeoutSeconds', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="healthCheck.retries" className="text-xs text-muted-foreground">
              Retries
            </Label>
            <Input
              id="healthCheck.retries"
              type="number"
              {...register('healthCheck.retries', { valueAsNumber: true })}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save Configuration
        </Button>
      </div>
    </form>
  );
}
