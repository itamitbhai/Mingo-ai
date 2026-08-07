import { create } from 'zustand';
import type { IProject } from 'shared';

interface EditProjectState {
  project: IProject | null;
  open: (project: IProject) => void;
  close: () => void;
}

export const useEditProjectStore = create<EditProjectState>((set) => ({
  project: null,
  open: (project) => set({ project }),
  close: () => set({ project: null }),
}));
