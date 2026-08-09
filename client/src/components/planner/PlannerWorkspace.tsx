'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { IProjectPlan, TaskPriority } from 'shared';

import { ApiError } from '@/lib/api';
import * as plannerService from '@/services/planner/planner.service';
import { usePlannerStore } from '@/store/use-planner-store';
import { PlanDiffDialog } from './PlanDiffDialog';
import { PlannerPromptForm } from './PlannerPromptForm';
import { PlanVersionHistory } from './PlanVersionHistory';
import { PlanView } from './PlanView';

interface PlannerWorkspaceProps {
  projectId: string;
}

export function PlannerWorkspace({ projectId }: PlannerWorkspaceProps) {
  const { getToken } = useAuth();
  const runStatus = usePlannerStore((state) => state.runStatus);
  const stage = usePlannerStore((state) => state.stage);
  const stageLabel = usePlannerStore((state) => state.stageLabel);
  const streamError = usePlannerStore((state) => state.streamError);
  const currentPlan = usePlannerStore((state) => state.currentPlan);
  const planHistory = usePlannerStore((state) => state.planHistory);
  const pendingDiff = usePlannerStore((state) => state.pendingDiff);

  const startRun = usePlannerStore((state) => state.startRun);
  const setStage = usePlannerStore((state) => state.setStage);
  const finishRun = usePlannerStore((state) => state.finishRun);
  const failRun = usePlannerStore((state) => state.failRun);
  const setCurrentPlan = usePlannerStore((state) => state.setCurrentPlan);
  const setPlanHistory = usePlannerStore((state) => state.setPlanHistory);
  const setPendingDiff = usePlannerStore((state) => state.setPendingDiff);
  const reset = usePlannerStore((state) => state.reset);

  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const token = await getToken();
      const result = await plannerService.listPlans(projectId, token);
      setPlanHistory(result.items);
      if (result.items.length > 0 && !currentPlan) {
        setCurrentPlan(result.items[0]);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load plan history');
    } finally {
      setIsLoadingHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, getToken]);

  useEffect(() => {
    reset();
    void loadHistory();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleGenerate(prompt: string) {
    startRun();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getToken();
      await plannerService.streamPlanGeneration(
        projectId,
        { prompt },
        token,
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'stage') {
              setStage(event.stage, event.label);
            } else if (event.type === 'done') {
              finishRun(event.plan);
              void loadHistory();
              toast.success('Plan ready');
            } else if (event.type === 'error') {
              failRun(event.message);
              toast.error(event.message);
            }
          },
        }
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to generate plan';
      failRun(message);
      toast.error(message);
    }
  }

  async function handleRegenerate() {
    if (!currentPlan) return;
    startRun();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getToken();
      await plannerService.streamRegeneratePlan(
        projectId,
        currentPlan.id,
        {},
        token,
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'stage') {
              setStage(event.stage, event.label);
            } else if (event.type === 'done') {
              finishRun(event.plan);
              if (event.previousPlan && event.diff) {
                setPendingDiff({ previousPlan: event.previousPlan, diff: event.diff });
                setIsDiffOpen(true);
              }
              void loadHistory();
              toast.success('Plan regenerated');
            } else if (event.type === 'error') {
              failRun(event.message);
              toast.error(event.message);
            }
          },
        }
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to regenerate plan';
      failRun(message);
      toast.error(message);
    }
  }

  async function handleDecision(status: 'approved' | 'rejected') {
    if (!currentPlan) return;
    setIsSubmittingAction(true);
    try {
      const token = await getToken();
      const updated = await plannerService.updatePlan(projectId, currentPlan.id, { status }, token);
      setCurrentPlan(updated);
      setPlanHistory(planHistory.map((plan) => (plan.id === updated.id ? updated : plan)));
      toast.success(status === 'approved' ? 'Plan approved' : 'Plan rejected');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update plan');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  async function handleEditFeature(edit: { id: string; title?: string; description?: string; priority?: TaskPriority }) {
    if (!currentPlan) return;
    try {
      const token = await getToken();
      const updated = await plannerService.updatePlan(
        projectId,
        currentPlan.id,
        { featureEdits: [edit] },
        token
      );
      setCurrentPlan(updated);
      toast.success('Feature updated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update feature');
    }
  }

  async function handleEditTask(edit: { id: string; title?: string; description?: string; acceptanceCriteria?: string[] }) {
    if (!currentPlan) return;
    try {
      const token = await getToken();
      const updated = await plannerService.updatePlan(projectId, currentPlan.id, { taskEdits: [edit] }, token);
      setCurrentPlan(updated);
      toast.success('Task updated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to update task');
    }
  }

  function handleSelectVersion(plan: IProjectPlan) {
    setCurrentPlan(plan);
  }

  const isStreaming = runStatus === 'streaming';

  return (
    <div className="flex flex-col gap-4">
      <PlannerPromptForm
        onSubmit={handleGenerate}
        isStreaming={isStreaming}
        stage={stage}
        stageLabel={stageLabel}
        error={streamError}
      />

      {!isLoadingHistory && planHistory.length > 0 && (
        <PlanVersionHistory plans={planHistory} currentPlanId={currentPlan?.id} onSelect={handleSelectVersion} />
      )}

      {currentPlan && (
        <PlanView
          plan={currentPlan}
          isSubmitting={isSubmittingAction || isStreaming}
          onApprove={() => void handleDecision('approved')}
          onReject={() => void handleDecision('rejected')}
          onRegenerate={() => void handleRegenerate()}
          onEditFeature={(edit) => void handleEditFeature(edit)}
          onEditTask={(edit) => void handleEditTask(edit)}
        />
      )}

      <PlanDiffDialog
        open={isDiffOpen}
        onOpenChange={(open) => {
          setIsDiffOpen(open);
          if (!open) setPendingDiff(null);
        }}
        diff={pendingDiff?.diff ?? null}
      />
    </div>
  );
}
