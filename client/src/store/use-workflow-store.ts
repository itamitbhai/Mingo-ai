import { create } from 'zustand';
import { WorkflowStatus, type IWorkflow, type IWorkflowEvent } from 'shared';

export type WorkflowStreamStatus = 'idle' | 'connecting' | 'connected' | 'error';

const WORKFLOW_STATUS_VALUES: string[] = Object.values(WorkflowStatus);
const MAX_CLIENT_EVENTS = 200;

/** Non-persisted — mirrors `use-test-run-store.ts`'s pattern. Holds the current workflow snapshot,
 *  its live event log, and the SSE connection status; nothing here survives a refresh (a reload
 *  re-fetches the workflow and re-attaches to its event stream). */
interface WorkflowState {
  workflow: IWorkflow | null;
  events: IWorkflowEvent[];
  streamStatus: WorkflowStreamStatus;
  streamError: string | null;
  selectedTaskId: string | null;

  setWorkflow: (workflow: IWorkflow) => void;
  /** Incrementally patches the local snapshot from one live event, rather than re-fetching on every
   *  message — an event with a `taskId` carries a `WorkflowTaskStatus` for that task; one without
   *  carries the overall `WorkflowStatus` (spec §21's payload shape). */
  applyEvent: (event: IWorkflowEvent) => void;
  setStreamStatus: (status: WorkflowStreamStatus) => void;
  setStreamError: (message: string | null) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  reset: () => void;
}

const initialState = {
  workflow: null as IWorkflow | null,
  events: [] as IWorkflowEvent[],
  streamStatus: 'idle' as WorkflowStreamStatus,
  streamError: null as string | null,
  selectedTaskId: null as string | null,
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,

  setWorkflow: (workflow) => set({ workflow, events: workflow.events.slice(-MAX_CLIENT_EVENTS) }),

  applyEvent: (event) => {
    const current = get().workflow;
    const events = [...get().events, event].slice(-MAX_CLIENT_EVENTS);

    if (!current) {
      set({ events });
      return;
    }

    if (event.taskId && event.status) {
      const tasks = current.tasks.map((task) =>
        task.taskId === event.taskId ? { ...task, status: event.status as never } : task
      );
      set({ workflow: { ...current, tasks }, events });
      return;
    }

    if (!event.taskId && event.status && WORKFLOW_STATUS_VALUES.includes(event.status)) {
      set({ workflow: { ...current, status: event.status as WorkflowStatus }, events });
      return;
    }

    set({ events });
  },

  setStreamStatus: (streamStatus) => set({ streamStatus }),
  setStreamError: (streamError) => set({ streamError }),
  setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
  reset: () => set(initialState),
}));
