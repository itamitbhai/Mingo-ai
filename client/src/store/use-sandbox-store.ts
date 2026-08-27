import { create } from 'zustand';
import { SandboxStatus } from 'shared';

export interface TerminalEntry {
  sandboxId: string;
  command: string;
  args: string[];
  status: SandboxStatus;
  output: string;
  exitCode?: number;
  error?: string;
}

const MAX_ENTRY_OUTPUT_CHARS = 200000;

/** Non-persisted — mirrors `use-workflow-store.ts`'s pattern. `entries` is the terminal's visible
 *  scrollback: one entry per command run (spec §1 of the Phase 11 plan — a sandbox never outlives one
 *  command, so "the terminal" is just a list of these, not a single long-lived session object). */
interface SandboxState {
  entries: TerminalEntry[];
  isRunning: boolean;
  streamError: string | null;

  startEntry: (sandboxId: string, command: string, args: string[]) => void;
  appendOutput: (sandboxId: string, chunk: string) => void;
  finishEntry: (sandboxId: string, status: SandboxStatus, exitCode?: number, error?: string) => void;
  setRunning: (running: boolean) => void;
  setStreamError: (message: string | null) => void;
  clear: () => void;
  reset: () => void;
}

const initialState = {
  entries: [] as TerminalEntry[],
  isRunning: false,
  streamError: null as string | null,
};

export const useSandboxStore = create<SandboxState>((set) => ({
  ...initialState,

  startEntry: (sandboxId, command, args) =>
    set((state) => ({
      entries: [
        ...state.entries,
        { sandboxId, command, args, status: SandboxStatus.CREATING, output: '' },
      ],
      isRunning: true,
      streamError: null,
    })),

  appendOutput: (sandboxId, chunk) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.sandboxId === sandboxId
          ? { ...entry, output: (entry.output + chunk).slice(-MAX_ENTRY_OUTPUT_CHARS), status: SandboxStatus.RUNNING }
          : entry
      ),
    })),

  finishEntry: (sandboxId, status, exitCode, error) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.sandboxId === sandboxId ? { ...entry, status, exitCode, error } : entry
      ),
      isRunning: false,
    })),

  setRunning: (running) => set({ isRunning: running }),
  setStreamError: (message) => set({ streamError: message }),
  clear: () => set({ entries: [] }),
  reset: () => set(initialState),
}));
