import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_EDITOR_PREFERENCES, type EditorPreferences } from '@/types/workspace';

interface ProjectWorkspaceUI {
  expandedFolders: string[];
  openTabPaths: string[];
  activeTabPath: string | null;
}

const EMPTY_PROJECT_UI: ProjectWorkspaceUI = {
  expandedFolders: [],
  openTabPaths: [],
  activeTabPath: null,
};

interface WorkspaceUIState {
  byProject: Record<string, ProjectWorkspaceUI>;
  isExplorerOpen: boolean;
  isAIChatOpen: boolean;
  isBottomPanelOpen: boolean;
  editorPreferences: EditorPreferences;

  toggleExplorer: () => void;
  toggleAIChat: () => void;
  toggleBottomPanel: () => void;
  setEditorPreferences: (prefs: Partial<EditorPreferences>) => void;

  getProjectUI: (projectId: string) => ProjectWorkspaceUI;
  toggleFolder: (projectId: string, path: string) => void;
  setExpandedFolders: (projectId: string, paths: string[]) => void;
  openTab: (projectId: string, path: string) => void;
  closeTab: (projectId: string, path: string) => void;
  closeOtherTabs: (projectId: string, path: string) => void;
  closeAllTabs: (projectId: string) => void;
  setActiveTab: (projectId: string, path: string | null) => void;
  renamePath: (projectId: string, oldPath: string, newPath: string) => void;
  removePath: (projectId: string, pathOrPrefix: string) => void;
}

function updateProject(
  state: WorkspaceUIState,
  projectId: string,
  updater: (project: ProjectWorkspaceUI) => ProjectWorkspaceUI
): Pick<WorkspaceUIState, 'byProject'> {
  const current = state.byProject[projectId] ?? EMPTY_PROJECT_UI;
  return { byProject: { ...state.byProject, [projectId]: updater(current) } };
}

export const useWorkspaceUIStore = create<WorkspaceUIState>()(
  persist(
    (set, get) => ({
      byProject: {},
      isExplorerOpen: true,
      isAIChatOpen: true,
      isBottomPanelOpen: false,
      editorPreferences: DEFAULT_EDITOR_PREFERENCES,

      toggleExplorer: () => set((state) => ({ isExplorerOpen: !state.isExplorerOpen })),
      toggleAIChat: () => set((state) => ({ isAIChatOpen: !state.isAIChatOpen })),
      toggleBottomPanel: () => set((state) => ({ isBottomPanelOpen: !state.isBottomPanelOpen })),
      setEditorPreferences: (prefs) =>
        set((state) => ({ editorPreferences: { ...state.editorPreferences, ...prefs } })),

      getProjectUI: (projectId) => get().byProject[projectId] ?? EMPTY_PROJECT_UI,

      toggleFolder: (projectId, path) =>
        set((state) =>
          updateProject(state, projectId, (project) => ({
            ...project,
            expandedFolders: project.expandedFolders.includes(path)
              ? project.expandedFolders.filter((p) => p !== path)
              : [...project.expandedFolders, path],
          }))
        ),

      setExpandedFolders: (projectId, paths) =>
        set((state) => updateProject(state, projectId, (project) => ({ ...project, expandedFolders: paths }))),

      openTab: (projectId, path) =>
        set((state) =>
          updateProject(state, projectId, (project) => ({
            ...project,
            openTabPaths: project.openTabPaths.includes(path)
              ? project.openTabPaths
              : [...project.openTabPaths, path],
            activeTabPath: path,
          }))
        ),

      closeTab: (projectId, path) =>
        set((state) =>
          updateProject(state, projectId, (project) => {
            const openTabPaths = project.openTabPaths.filter((p) => p !== path);
            const wasActive = project.activeTabPath === path;
            return {
              ...project,
              openTabPaths,
              activeTabPath: wasActive ? (openTabPaths[openTabPaths.length - 1] ?? null) : project.activeTabPath,
            };
          })
        ),

      closeOtherTabs: (projectId, path) =>
        set((state) =>
          updateProject(state, projectId, () => ({
            expandedFolders: state.byProject[projectId]?.expandedFolders ?? [],
            openTabPaths: [path],
            activeTabPath: path,
          }))
        ),

      closeAllTabs: (projectId) =>
        set((state) =>
          updateProject(state, projectId, (project) => ({
            ...project,
            openTabPaths: [],
            activeTabPath: null,
          }))
        ),

      setActiveTab: (projectId, path) =>
        set((state) => updateProject(state, projectId, (project) => ({ ...project, activeTabPath: path }))),

      renamePath: (projectId, oldPath, newPath) =>
        set((state) =>
          updateProject(state, projectId, (project) => ({
            expandedFolders: project.expandedFolders.map((p) => (p === oldPath ? newPath : p)),
            openTabPaths: project.openTabPaths.map((p) => (p === oldPath ? newPath : p)),
            activeTabPath: project.activeTabPath === oldPath ? newPath : project.activeTabPath,
          }))
        ),

      removePath: (projectId, pathOrPrefix) =>
        set((state) =>
          updateProject(state, projectId, (project) => {
            const matches = (p: string) => p === pathOrPrefix || p.startsWith(`${pathOrPrefix}/`);
            const openTabPaths = project.openTabPaths.filter((p) => !matches(p));
            return {
              expandedFolders: project.expandedFolders.filter((p) => !matches(p)),
              openTabPaths,
              activeTabPath: project.activeTabPath && matches(project.activeTabPath)
                ? (openTabPaths[openTabPaths.length - 1] ?? null)
                : project.activeTabPath,
            };
          })
        ),
    }),
    {
      name: 'mingo-workspace-ui',
      // Explicitly whitelisted "safe UI preference" fields only — never file content.
      partialize: (state) => ({
        byProject: state.byProject,
        isExplorerOpen: state.isExplorerOpen,
        isAIChatOpen: state.isAIChatOpen,
        isBottomPanelOpen: state.isBottomPanelOpen,
        editorPreferences: state.editorPreferences,
      }),
    }
  )
);
