export interface FileSearchMatch {
  line: number;
  snippet: string;
}

export interface FileSearchResult {
  path: string;
  name: string;
  matches: FileSearchMatch[];
}

export interface EditorTab {
  path: string;
  name: string;
  language: string;
}

export interface OpenFileState {
  path: string;
  content: string;
  originalContent: string;
  version: number;
  language: string;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  saveError: boolean;
}

export type FileStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'conflict';

export interface EditorPreferences {
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  tabSize: number;
  autoSave: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 14,
  wordWrap: false,
  minimap: true,
  tabSize: 2,
  autoSave: true,
};

export interface AIContextAttachment {
  filePath: string;
  language: string;
  selectedCode?: string;
}

export interface EditorProblem {
  filePath: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  line: number;
  column: number;
}
