'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { ProjectPlanStatus, type ITaskBoardItem, type ITestResult, type ITestRunScope } from 'shared';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import * as frontendAgentService from '@/services/frontend-agent.service';
import * as plannerService from '@/services/planner/planner.service';
import * as testRunService from '@/services/test-run.service';
import { useFrontendAgentStore } from '@/store/use-frontend-agent-store';
import { useTestRunStore } from '@/store/use-test-run-store';
import type { FrontendAgentStreamEvent } from '@/types/frontend-agent';
import type { TestRunStreamEvent } from '@/types/test-run';
import { AgentProgress } from './AgentProgress';
import { ChangePreview } from './ChangePreview';
import { GenerationHistory } from './GenerationHistory';
import { TaskList } from './TaskList';
import { TestResultsPanel } from './TestResultsPanel';

interface FrontendAgentPanelProps {
  projectId: string;
  onClose?: () => void;
}

/** Top-level Frontend Agent panel embedded in the Browser IDE (spec §53) — mirrors
 *  `PlannerWorkspace.tsx`'s structure: SSE-driven actions live directly in this component, state in
 *  `useFrontendAgentStore`, REST/SSE calls in `frontend-agent.service.ts`. */
export function FrontendAgentPanel({ projectId, onClose }: FrontendAgentPanelProps) {
  const { getToken } = useAuth();

  const runStatus = useFrontendAgentStore((state) => state.runStatus);
  const activeTaskId = useFrontendAgentStore((state) => state.activeTaskId);
  const stage = useFrontendAgentStore((state) => state.stage);
  const stageLabel = useFrontendAgentStore((state) => state.stageLabel);
  const streamError = useFrontendAgentStore((state) => state.streamError);
  const taskBoard = useFrontendAgentStore((state) => state.taskBoard);
  const activeGeneration = useFrontendAgentStore((state) => state.activeGeneration);
  const generationHistory = useFrontendAgentStore((state) => state.generationHistory);

  const startRun = useFrontendAgentStore((state) => state.startRun);
  const setStage = useFrontendAgentStore((state) => state.setStage);
  const finishRun = useFrontendAgentStore((state) => state.finishRun);
  const failRun = useFrontendAgentStore((state) => state.failRun);
  const setTaskBoard = useFrontendAgentStore((state) => state.setTaskBoard);
  const setActiveGeneration = useFrontendAgentStore((state) => state.setActiveGeneration);
  const setGenerationHistory = useFrontendAgentStore((state) => state.setGenerationHistory);
  const reset = useFrontendAgentStore((state) => state.reset);

  const testRunStatus = useTestRunStore((state) => state.runStatus);
  const testRunStage = useTestRunStore((state) => state.stage);
  const testRunStageLabel = useTestRunStore((state) => state.stageLabel);
  const testRunStreamError = useTestRunStore((state) => state.streamError);
  const activeTestRun = useTestRunStore((state) => state.activeTestRun);
  const testAnalyses = useTestRunStore((state) => state.analyses);
  const startTestRun = useTestRunStore((state) => state.startRun);
  const setTestRunStage = useTestRunStore((state) => state.setStage);
  const setTestRunQueued = useTestRunStore((state) => state.setQueued);
  const finishTestRun = useTestRunStore((state) => state.finishRun);
  const failTestRun = useTestRunStore((state) => state.failRun);
  const setAnalysis = useTestRunStore((state) => state.setAnalysis);
  const resetTestRun = useTestRunStore((state) => state.reset);

  const [planId, setPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [testRunTaskId, setTestRunTaskId] = useState<string | null>(null);
  const [explainingIndex, setExplainingIndex] = useState<number | null>(null);
  const [fixingIndex, setFixingIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const testRunAbortRef = useRef<AbortController | null>(null);

  const loadTasks = useCallback(
    async (activePlanId: string) => {
      try {
        const token = await getToken();
        const tasks = await frontendAgentService.listTasks(projectId, activePlanId, token);
        setTaskBoard(tasks);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : 'Failed to load tasks');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, getToken]
  );

  const loadApprovedPlan = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const result = await plannerService.listPlans(projectId, token);
      const approved = result.items.find((plan) => plan.status === ProjectPlanStatus.APPROVED);

      if (approved) {
        setPlanId(approved.id);
        await loadTasks(approved.id);
      } else {
        setPlanId(null);
        setTaskBoard([]);
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load the approved plan');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, getToken, loadTasks]);

  useEffect(() => {
    reset();
    resetTestRun();
    setTestRunTaskId(null);
    void loadApprovedPlan();
    return () => {
      abortRef.current?.abort();
      testRunAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function openReview(task: ITaskBoardItem) {
    if (!planId || !task.latestGenerationId) return;
    try {
      const token = await getToken();
      const [generation, history] = await Promise.all([
        frontendAgentService.getGeneration(projectId, planId, task.id, task.latestGenerationId, token),
        frontendAgentService.listGenerations(projectId, planId, task.id, token),
      ]);
      setActiveGeneration(generation);
      setGenerationHistory(history);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to load the generation');
    }
  }

  async function runTask(taskId: string, feedback?: string) {
    if (!planId) return;
    startRun(taskId);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = await getToken();

      const onEvent = (event: FrontendAgentStreamEvent) => {
        if (event.type === 'stage') {
          setStage(event.stage, event.label);
        } else if (event.type === 'done') {
          finishRun(event.generation);
          void loadTasks(planId);
          void frontendAgentService
            .listGenerations(projectId, planId, taskId, token)
            .then(setGenerationHistory)
            .catch(() => undefined);
          toast.success('Changes ready for review');
        } else if (event.type === 'error') {
          failRun(event.message);
          toast.error(event.message);
        }
      };

      if (feedback !== undefined) {
        await frontendAgentService.streamRegenerateTask(
          projectId,
          planId,
          taskId,
          { feedback },
          token,
          { signal: controller.signal, onEvent }
        );
      } else {
        await frontendAgentService.streamExecuteTask(projectId, planId, taskId, token, {
          signal: controller.signal,
          onEvent,
        });
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to run the Frontend Agent';
      failRun(message);
      toast.error(message);
    }
  }

  async function handleApply() {
    if (!activeGeneration) return;
    setIsSubmittingDecision(true);
    try {
      const token = await getToken();
      await frontendAgentService.applyGeneration(projectId, { generationId: activeGeneration.id }, token);
      toast.success('Changes applied');
      if (activeGeneration.agentType === 'testing') {
        setTestRunTaskId(activeGeneration.taskId);
      }
      setActiveGeneration(null);
      if (planId) void loadTasks(planId);
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
      if (planId) void loadTasks(planId);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to reject changes');
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  async function runTests(task: ITaskBoardItem, scope: ITestRunScope = 'all') {
    if (!planId) return;
    setTestRunTaskId(task.id);
    startTestRun(task.id);
    const controller = new AbortController();
    testRunAbortRef.current = controller;

    try {
      const token = await getToken();

      const onEvent = (event: TestRunStreamEvent) => {
        if (event.type === 'queued') {
          setTestRunQueued(event.testRun);
        } else if (event.type === 'stage') {
          setTestRunStage(event.stage, event.label);
        } else if (event.type === 'done') {
          finishTestRun(event.testRun);
          const failed = event.testRun.summary?.failed ?? 0;
          if (event.testRun.status === 'passed') {
            toast.success('All tests passed');
          } else if (failed > 0) {
            toast.error(`${failed} test${failed === 1 ? '' : 's'} failed`);
          } else {
            toast.error('Test run did not pass — see logs for details');
          }
        } else if (event.type === 'error') {
          failTestRun(event.message);
          toast.error(event.message);
        }
      };

      await testRunService.streamCreateTestRun(projectId, planId, task.id, scope, token, {
        signal: controller.signal,
        onEvent,
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to run tests';
      failTestRun(message);
      toast.error(message);
    }
  }

  async function handleCancelTestRun() {
    if (!activeTestRun) return;
    testRunAbortRef.current?.abort();
    try {
      const token = await getToken();
      await testRunService.cancelTestRun(projectId, activeTestRun.id, token);
    } catch {
      // Best-effort — the client-side abort already stopped listening either way.
    }
  }

  async function handleExplainFailure(resultIndex: number) {
    if (!activeTestRun) return;
    setExplainingIndex(resultIndex);
    try {
      const token = await getToken();
      const analysis = await testRunService.explainFailure(projectId, activeTestRun.id, resultIndex, token);
      setAnalysis(resultIndex, analysis);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to analyze this failure');
    } finally {
      setExplainingIndex(null);
    }
  }

  async function handleGenerateTestFix(resultIndex: number) {
    if (!activeTestRun) return;
    setFixingIndex(resultIndex);
    try {
      const token = await getToken();
      const generation = await testRunService.generateFix(projectId, activeTestRun.id, resultIndex, token);
      setActiveGeneration(generation);
      toast.success('Fix ready for review');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to generate a fix');
    } finally {
      setFixingIndex(null);
    }
  }

  function handleRunFailedTests() {
    const task = taskBoard.find((candidate) => candidate.id === testRunTaskId);
    if (task) void runTests(task, 'failed');
  }

  function handleRunSingleFile(result: ITestResult) {
    const task = taskBoard.find((candidate) => candidate.id === testRunTaskId);
    if (task && result.file) void runTests(task, { file: result.file });
  }

  const isStreaming = runStatus === 'streaming';
  const isTestRunStreaming = testRunStatus === 'streaming';

  if (isLoading) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!planId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-medium">No approved plan yet</p>
        <p className="text-xs text-muted-foreground">
          Approve a plan in the Planner before running the Frontend, Backend, or Database Agent.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Mingo AI Agents</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {isStreaming && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Task: {activeTaskId}</p>
          <AgentProgress stage={stage} stageLabel={stageLabel} />
        </div>
      )}

      {!isStreaming && streamError && <AgentProgress stage="error" stageLabel="" error={streamError} />}

      {activeGeneration && (
        <>
          <ChangePreview
            generation={activeGeneration}
            isSubmitting={isSubmittingDecision}
            onApply={() => void handleApply()}
            onReject={() => void handleReject()}
            onRegenerate={(feedback) => void runTask(activeGeneration.taskId, feedback || undefined)}
          />
          <GenerationHistory generations={generationHistory} />
        </>
      )}

      {testRunTaskId && (
        <TestResultsPanel
          testRun={activeTestRun}
          isStreaming={isTestRunStreaming}
          stage={testRunStage}
          stageLabel={testRunStageLabel}
          streamError={testRunStreamError}
          analyses={testAnalyses}
          explainingIndex={explainingIndex}
          fixingIndex={fixingIndex}
          onRunAll={() => {
            const task = taskBoard.find((candidate) => candidate.id === testRunTaskId);
            if (task) void runTests(task, 'all');
          }}
          onRunFailed={handleRunFailedTests}
          onCancel={() => void handleCancelTestRun()}
          onExplain={(index) => void handleExplainFailure(index)}
          onGenerateFix={(index) => void handleGenerateTestFix(index)}
          onRunFile={handleRunSingleFile}
        />
      )}

      <TaskList
        tasks={taskBoard}
        busyTaskId={isStreaming ? activeTaskId : null}
        onRun={(taskId) => void runTask(taskId)}
        onReview={(task) => void openReview(task)}
        onRunTests={(task) => void runTests(task)}
      />
    </div>
  );
}
