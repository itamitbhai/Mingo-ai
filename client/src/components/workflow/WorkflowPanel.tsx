'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ProjectPlanStatus, WorkflowTaskStatus, type IPlanTask } from 'shared';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import * as frontendAgentService from '@/services/frontend-agent.service';
import * as plannerService from '@/services/planner/planner.service';
import * as workflowService from '@/services/workflow.service';
import { useFrontendAgentStore } from '@/store/use-frontend-agent-store';
import { useWorkflowStore } from '@/store/use-workflow-store';
import type { WorkflowStreamEvent } from '@/types/workflow';
import { ChangePreview } from '../agent/ChangePreview';
import { GenerationHistory } from '../agent/GenerationHistory';
import { FailurePanel } from './FailurePanel';
import { TaskDetails } from './TaskDetails';
import { TaskGraph } from './TaskGraph';
import { WorkflowControls } from './WorkflowControls';
import { WorkflowProgress } from './WorkflowProgress';

interface WorkflowPanelProps {
  projectId: string;
  onClose?: () => void;
}

/**
 * Top-level Orchestrator panel embedded in the Browser IDE (Phase 10 spec §60) — mirrors
 * `FrontendAgentPanel.tsx`'s structure: SSE-driven live updates land directly in this component,
 * state in `useWorkflowStore`, REST/SSE calls in `workflow.service.ts`. A `needs_review` task's diff
 * reuses the exact same `ChangePreview`/apply/reject flow every other agent uses — no new diff UI.
 */
export function WorkflowPanel({ projectId, onClose }: WorkflowPanelProps) {
  const { getToken } = useAuth();

  const workflow = useWorkflowStore((state) => state.workflow);
  const streamStatus = useWorkflowStore((state) => state.streamStatus);
  const streamError = useWorkflowStore((state) => state.streamError);
  const selectedTaskId = useWorkflowStore((state) => state.selectedTaskId);
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
  const applyEvent = useWorkflowStore((state) => state.applyEvent);
  const setStreamStatus = useWorkflowStore((state) => state.setStreamStatus);
  const setStreamErrorState = useWorkflowStore((state) => state.setStreamError);
  const setSelectedTaskId = useWorkflowStore((state) => state.setSelectedTaskId);
  const resetWorkflowStore = useWorkflowStore((state) => state.reset);

  const activeGeneration = useFrontendAgentStore((state) => state.activeGeneration);
  const generationHistory = useFrontendAgentStore((state) => state.generationHistory);
  const setActiveGeneration = useFrontendAgentStore((state) => state.setActiveGeneration);
  const setGenerationHistory = useFrontendAgentStore((state) => state.setGenerationHistory);

  const [planId, setPlanId] = useState<string | null>(null);
  const [planTasks, setPlanTasks] = useState<IPlanTask[]>([]);
  const [mode, setMode] = useState<'auto' | 'review'>('review');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isControlBusy, setIsControlBusy] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  const loadWorkflowPanel = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const [plans, workflows] = await Promise.all([
        plannerService.listPlans(projectId, token),
        workflowService.listWorkflows(projectId, token),
      ]);

      const approved = plans.items.find((plan) => plan.status === ProjectPlanStatus.APPROVED);
      if (approved) {
        setPlanId(approved.id);
        setPlanTasks(approved.tasks ?? []);
      } else {
        setPlanId(null);
        setPlanTasks([]);
      }

      const latest = workflows[0];
      if (latest) setWorkflow(latest);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, getToken]);

  useEffect(() => {
    resetWorkflowStore();
    setActiveGeneration(null);
    void loadWorkflowPanel();
    return () => streamAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const connectToWorkflow = useCallback(
    async (workflowId: string) => {
      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;
      setStreamStatus('connecting');
      setStreamErrorState(null);

      try {
        const token = await getToken();
        await workflowService.streamWorkflowEvents(projectId, workflowId, token, {
          signal: controller.signal,
          onEvent: (streamEvent: WorkflowStreamEvent) => {
            setStreamStatus('connected');
            applyEvent(streamEvent.event);
          },
        });
        setStreamStatus('idle');
      } catch (error) {
        if (controller.signal.aborted) return;
        setStreamStatus('error');
        setStreamErrorState(error instanceof ApiError ? error.message : 'Lost connection to the workflow.');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, getToken, applyEvent]
  );

  useEffect(() => {
    if (workflow?.id) void connectToWorkflow(workflow.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.id]);

  async function handleStart() {
    if (!planId) return;
    setIsStarting(true);
    try {
      const token = await getToken();
      const created = await workflowService.createWorkflow(projectId, { planId, mode }, token);
      setWorkflow(created);
      toast.success('Workflow started');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to start the workflow');
    } finally {
      setIsStarting(false);
    }
  }

  async function handlePause() {
    if (!workflow) return;
    setIsControlBusy(true);
    try {
      const token = await getToken();
      setWorkflow(await workflowService.pauseWorkflow(projectId, workflow.id, token));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to pause the workflow');
    } finally {
      setIsControlBusy(false);
    }
  }

  async function handleResume() {
    if (!workflow) return;
    setIsControlBusy(true);
    try {
      const token = await getToken();
      const updated = await workflowService.resumeWorkflow(projectId, workflow.id, token);
      setWorkflow(updated);
      void connectToWorkflow(updated.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to resume the workflow');
    } finally {
      setIsControlBusy(false);
    }
  }

  async function handleCancel() {
    if (!workflow) return;
    setIsControlBusy(true);
    try {
      const token = await getToken();
      setWorkflow(await workflowService.cancelWorkflow(projectId, workflow.id, token));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to cancel the workflow');
    } finally {
      setIsControlBusy(false);
    }
  }

  async function handleRetryTask(taskId: string) {
    if (!workflow) return;
    setIsRetrying(true);
    try {
      const token = await getToken();
      const updated = await workflowService.retryWorkflowTask(projectId, workflow.id, taskId, token);
      setWorkflow(updated);
      void connectToWorkflow(updated.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to retry the task');
    } finally {
      setIsRetrying(false);
    }
  }

  async function openReview(taskId: string) {
    if (!planId) return;
    const taskState = workflow?.tasks.find((task) => task.taskId === taskId);
    const generationId = taskState?.generationIds[taskState.generationIds.length - 1];
    if (!generationId) return;

    try {
      const token = await getToken();
      const [generation, history] = await Promise.all([
        frontendAgentService.getGeneration(projectId, planId, taskId, generationId, token),
        frontendAgentService.listGenerations(projectId, planId, taskId, token),
      ]);
      setActiveGeneration(generation);
      setGenerationHistory(history);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load the generation');
    }
  }

  async function handleApply() {
    if (!activeGeneration) return;
    setIsSubmittingDecision(true);
    try {
      const token = await getToken();
      await frontendAgentService.applyGeneration(projectId, { generationId: activeGeneration.id }, token);
      toast.success('Changes applied — Resume the workflow to continue.');
      setActiveGeneration(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to apply changes');
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  async function handleReject() {
    if (!activeGeneration) return;
    setIsSubmittingDecision(true);
    try {
      const token = await getToken();
      await frontendAgentService.rejectGeneration(projectId, { generationId: activeGeneration.id }, token);
      toast.success('Changes rejected');
      setActiveGeneration(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to reject changes');
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  async function handleRegenerate(feedback: string) {
    if (!activeGeneration || !planId) return;
    const taskId = activeGeneration.taskId;
    setIsSubmittingDecision(true);
    try {
      const token = await getToken();
      await frontendAgentService.streamRegenerateTask(projectId, planId, taskId, { feedback }, token, {
        signal: new AbortController().signal,
        onEvent: (event) => {
          if (event.type === 'done') {
            setActiveGeneration(event.generation);
            void frontendAgentService.listGenerations(projectId, planId, taskId, token).then(setGenerationHistory);
          } else if (event.type === 'error') {
            toast.error(event.message);
          }
        },
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to regenerate');
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  const selectedTask = planTasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedTaskState = workflow?.tasks.find((task) => task.taskId === selectedTaskId);

  if (isLoading) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!planId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-medium">No approved plan yet</p>
        <p className="text-xs text-muted-foreground">Approve a plan in the Planner before running a workflow.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Workflow</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {!workflow && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">Mode:</span>
            <Button size="sm" variant={mode === 'review' ? 'default' : 'outline'} onClick={() => setMode('review')}>
              Review
            </Button>
            <Button size="sm" variant={mode === 'auto' ? 'default' : 'outline'} onClick={() => setMode('auto')}>
              Auto
            </Button>
          </div>
          <Button size="sm" onClick={() => void handleStart()} disabled={isStarting}>
            {isStarting ? 'Starting…' : 'Run Workflow'}
          </Button>
        </div>
      )}

      {workflow && (
        <>
          <WorkflowProgress workflow={workflow} />
          <WorkflowControls
            status={workflow.status}
            isBusy={isControlBusy}
            onPause={() => void handlePause()}
            onResume={() => void handleResume()}
            onCancel={() => void handleCancel()}
          />

          {streamStatus === 'error' && streamError && <p className="text-xs text-destructive">{streamError}</p>}

          {activeGeneration && (
            <>
              <ChangePreview
                generation={activeGeneration}
                isSubmitting={isSubmittingDecision}
                onApply={() => void handleApply()}
                onReject={() => void handleReject()}
                onRegenerate={(feedback) => void handleRegenerate(feedback)}
              />
              <GenerationHistory generations={generationHistory} />
            </>
          )}

          <TaskGraph
            tasks={planTasks}
            taskStates={workflow.tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
          />

          {selectedTask && (
            <>
              <TaskDetails task={selectedTask} taskState={selectedTaskState} />
              {selectedTaskState?.status === WorkflowTaskStatus.FAILED && (
                <FailurePanel
                  task={selectedTask}
                  taskState={selectedTaskState}
                  isRetrying={isRetrying}
                  onRetry={() => void handleRetryTask(selectedTask.id)}
                />
              )}
              {selectedTaskState?.status === WorkflowTaskStatus.NEEDS_REVIEW && !activeGeneration && (
                <Button size="sm" onClick={() => void openReview(selectedTask.id)}>
                  Review Changes
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
