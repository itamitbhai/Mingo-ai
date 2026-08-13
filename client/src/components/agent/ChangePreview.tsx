'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { AgentGenerationStatus, type IAgentGeneration } from 'shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChangeFileList } from './ChangeFileList';
import { DatabaseSchemaPreview } from './DatabaseSchemaPreview';
import { TestPlanSummary } from './TestPlanSummary';

interface ChangePreviewProps {
  generation: IAgentGeneration;
  isSubmitting: boolean;
  onApply: () => void;
  onReject: () => void;
  onRegenerate: (feedback: string) => void;
}

/** Diff preview + approval flow for one Frontend Agent generation (spec §25/§26/§55). Changes are
 *  never written to the workspace until the user explicitly clicks Apply. */
export function ChangePreview({ generation, isSubmitting, onApply, onReject, onRegenerate }: ChangePreviewProps) {
  const [feedback, setFeedback] = useState('');
  const canDecide = generation.status === AgentGenerationStatus.PREVIEW_READY;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Changes ready (v{generation.version})</h3>
        <Badge variant="outline" className="capitalize">
          {generation.status.replace('_', ' ')}
        </Badge>
      </div>

      <ChangeFileList operations={generation.operations} />

      {generation.dependencyRequests.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
          <p className="mb-1 font-medium text-amber-500">Requested dependencies (not installed automatically):</p>
          <ul className="flex flex-col gap-0.5">
            {generation.dependencyRequests.map((dep) => (
              <li key={dep.name}>
                <span className="font-mono">{dep.name}</span>
                {dep.version ? ` (${dep.version})` : ''} — {dep.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {generation.contractWarnings && generation.contractWarnings.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
          <p className="mb-1 font-medium text-destructive">Contract warnings:</p>
          <ul className="flex flex-col gap-0.5">
            {generation.contractWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {generation.apiContracts && generation.apiContracts.length > 0 && (
        <div className="rounded-md border border-border/60 bg-card/30 p-2 text-xs">
          <p className="mb-1 font-medium">API endpoints in this change:</p>
          <ul className="flex flex-col gap-0.5 font-mono">
            {generation.apiContracts.map((contract) => (
              <li key={`${contract.method} ${contract.path}`}>
                {contract.method} {contract.path} {contract.authentication ? '(auth required)' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DatabaseSchemaPreview schemaContracts={generation.schemaContracts} databaseChanges={generation.databaseChanges} />

      <TestPlanSummary testPlan={generation.testPlan} />

      {generation.notes && <p className="text-xs text-muted-foreground">{generation.notes}</p>}

      {canDecide && (
        <>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional feedback for a regeneration, e.g. &quot;Use the existing Button component&quot;"
            rows={2}
            aria-label="Regeneration feedback"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={onApply} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Apply Changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReject}
              disabled={isSubmitting}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="size-4" /> Reject
            </Button>
            <Button variant="outline" size="sm" onClick={() => onRegenerate(feedback)} disabled={isSubmitting}>
              <RotateCcw className="size-4" /> Regenerate
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
