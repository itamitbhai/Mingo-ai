import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IProjectPlan } from 'shared';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('token') }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const listPlansMock = vi.fn();
const streamPlanGenerationMock = vi.fn();
const streamRegeneratePlanMock = vi.fn();
const updatePlanMock = vi.fn();
const streamAutopilotMock = vi.fn();

vi.mock('@/services/planner/planner.service', () => ({
  listPlans: (...args: unknown[]) => listPlansMock(...args),
  streamPlanGeneration: (...args: unknown[]) => streamPlanGenerationMock(...args),
  streamRegeneratePlan: (...args: unknown[]) => streamRegeneratePlanMock(...args),
  updatePlan: (...args: unknown[]) => updatePlanMock(...args),
}));

vi.mock('@/services/autopilot.service', () => ({
  streamAutopilot: (...args: unknown[]) => streamAutopilotMock(...args),
}));

import { useAutopilotStore } from '@/store/use-autopilot-store';
import { usePlannerStore } from '@/store/use-planner-store';
import { PlannerWorkspace } from './PlannerWorkspace';

const PLAN: IProjectPlan = {
  id: 'plan1',
  project: 'p1',
  owner: 'u1',
  version: 1,
  status: 'ready',
  prompt: 'Build a todo app',
  summary: 'A todo app',
  projectType: 'Productivity',
  requirements: { explicit: [], inferred: [], missing: [] },
  stack: {},
  architecture: { description: '', nodes: [], edges: [] },
  features: [],
  database: { entities: [], relationships: [] },
  api: [],
  frontend: { pages: [], components: [], hooks: [], state: [] },
  files: [],
  tasks: [],
  executionOrder: [],
  risks: [],
  assumptions: [],
  security: [],
  nonFunctionalRequirements: [],
  conflicts: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const EMPTY_PAGE = {
  items: [] as IProjectPlan[],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
};

describe('PlannerWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlannerStore.getState().reset();
    useAutopilotStore.getState().reset();
    listPlansMock.mockResolvedValue(EMPTY_PAGE);
  });

  it('streams a plan generation and renders the resulting plan', async () => {
    streamPlanGenerationMock.mockImplementation(
      async (_projectId: string, _body: unknown, _token: string | null, handlers: { onEvent: (e: unknown) => void }) => {
        handlers.onEvent({ type: 'stage', stage: 'generating', label: 'Generating the plan…' });
        handlers.onEvent({ type: 'done', plan: PLAN });
      }
    );

    render(<PlannerWorkspace projectId="p1" />);

    fireEvent.change(await screen.findByLabelText('Project request'), {
      target: { value: 'Build a todo app for tracking chores' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));

    await waitFor(() => expect(screen.getByText('A todo app')).toBeInTheDocument());
    expect(streamPlanGenerationMock).toHaveBeenCalledWith(
      'p1',
      { prompt: 'Build a todo app for tracking chores' },
      'token',
      expect.anything()
    );
  });

  it('loads the latest plan from history on mount', async () => {
    listPlansMock.mockResolvedValue({ ...EMPTY_PAGE, items: [PLAN] });

    render(<PlannerWorkspace projectId="p1" />);

    await waitFor(() => expect(screen.getByText('A todo app')).toBeInTheDocument());
  });

  it('approves the current plan', async () => {
    listPlansMock.mockResolvedValue({ ...EMPTY_PAGE, items: [PLAN] });
    updatePlanMock.mockResolvedValue({ ...PLAN, status: 'approved' });

    render(<PlannerWorkspace projectId="p1" />);
    await waitFor(() => expect(screen.getByText('A todo app')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /approve plan/i }));

    await waitFor(() =>
      expect(updatePlanMock).toHaveBeenCalledWith('p1', 'plan1', { status: 'approved' }, 'token')
    );
  });

  it('shows a friendly error when the stream reports one', async () => {
    streamPlanGenerationMock.mockImplementation(
      async (_projectId: string, _body: unknown, _token: string | null, handlers: { onEvent: (e: unknown) => void }) => {
        handlers.onEvent({ type: 'error', message: 'The planner could not generate a plan right now.' });
      }
    );

    render(<PlannerWorkspace projectId="p1" />);

    fireEvent.change(await screen.findByLabelText('Project request'), {
      target: { value: 'Build a todo app for tracking chores' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));

    await waitFor(() =>
      expect(screen.getByText('The planner could not generate a plan right now.')).toBeInTheDocument()
    );
  });

  it('streams a Build It Now run and lands the resulting plan in the planner store', async () => {
    streamAutopilotMock.mockImplementation(
      async (_projectId: string, _body: unknown, _token: string | null, handlers: { onEvent: (e: unknown) => void }) => {
        handlers.onEvent({ phase: 'planning', type: 'stage', stage: 'generating', label: 'Generating the plan…' });
        handlers.onEvent({
          type: 'done',
          plan: PLAN,
          tasks: [{ taskId: 'T1', title: 'Build header', outcome: 'completed', generationId: 'g1' }],
          stoppedEarly: false,
        });
      }
    );

    render(<PlannerWorkspace projectId="p1" />);

    fireEvent.change(await screen.findByLabelText('Project request'), {
      target: { value: 'Build a todo app for tracking chores' },
    });
    fireEvent.click(screen.getByRole('button', { name: /build it now/i }));

    await waitFor(() => expect(screen.getByText('Build header')).toBeInTheDocument());
    expect(streamAutopilotMock).toHaveBeenCalledWith(
      'p1',
      { prompt: 'Build a todo app for tracking chores' },
      'token',
      expect.anything()
    );
    expect(usePlannerStore.getState().currentPlan).toEqual(PLAN);
  });
});
