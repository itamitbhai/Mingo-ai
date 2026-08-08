'use client';

import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

import { useWorkspaceUIStore } from '@/store/use-workspace-ui-store';
import type { OpenFileState } from '@/types/workspace';

export const MINGO_DARK_THEME = 'mingo-dark';

const defineMingoTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(MINGO_DARK_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c4b5fd' },
      { token: 'string', foreground: 'a5d6a7' },
      { token: 'number', foreground: 'f9a8d4' },
      { token: 'type', foreground: '93c5fd' },
      { token: 'function', foreground: '7dd3fc' },
      { token: 'variable', foreground: 'e5e7eb' },
    ],
    colors: {
      'editor.background': '#0d0d14',
      'editor.foreground': '#e5e7eb',
      'editor.lineHighlightBackground': '#161622',
      'editorLineNumber.foreground': '#4b5563',
      'editorLineNumber.activeForeground': '#a78bfa',
      'editorCursor.foreground': '#a78bfa',
      'editor.selectionBackground': '#312e5480',
      'editorIndentGuide.background': '#1f1f2e',
      'editorGutter.background': '#0d0d14',
      'editorWidget.background': '#161622',
      'editorWidget.border': '#27273a',
      'editorSuggestWidget.background': '#161622',
      'minimap.background': '#0d0d14',
    },
  });
};

interface MonacoEditorPaneProps {
  file: OpenFileState | undefined;
  onChange: (content: string) => void;
  onMount: OnMount;
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

export function MonacoEditorPane({ file, onChange, onMount }: MonacoEditorPaneProps) {
  const preferences = useWorkspaceUIStore((state) => state.editorPreferences);

  if (!file || file.isLoading) {
    return <LoadingState />;
  }

  return (
    <Editor
      path={file.path}
      language={file.language}
      value={file.content}
      theme={MINGO_DARK_THEME}
      beforeMount={defineMingoTheme}
      onMount={onMount}
      onChange={(value) => onChange(value ?? '')}
      loading={<LoadingState />}
      options={{
        fontSize: preferences.fontSize,
        wordWrap: preferences.wordWrap ? 'on' : 'off',
        minimap: { enabled: preferences.minimap },
        tabSize: preferences.tabSize,
        automaticLayout: true,
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        padding: { top: 12 },
        scrollBeyondLastLine: false,
        fixedOverflowWidgets: true,
      }}
    />
  );
}
