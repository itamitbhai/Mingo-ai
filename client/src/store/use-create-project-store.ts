import { create } from 'zustand';
import type { CreateProjectInput } from 'shared';

interface CreateProjectState {
  isOpen: boolean;
  prefill: Partial<CreateProjectInput> | null;
  open: (prefill?: Partial<CreateProjectInput>) => void;
  close: () => void;
}

export const useCreateProjectStore = create<CreateProjectState>((set) => ({
  isOpen: false,
  prefill: null,
  open: (prefill) => set({ isOpen: true, prefill: prefill ?? null }),
  close: () => set({ isOpen: false, prefill: null }),
}));
