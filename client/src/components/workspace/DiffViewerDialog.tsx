'use client';

import { DiffEditor, type BeforeMount } from '@monaco-editor/react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// A distinct theme id from `MonacoEditorPane`'s `mingo-dark` — reusing the same id here would let
// whichever editor mounts last silently overwrite the other's theme definition (Monaco's theme
// registry is global, shared across every editor instance on the page).
const MINGO_DARK_DIFF_THEME = 'mingo-dark-diff';

const defineMingoDiffTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(MINGO_DARK_DIFF_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0d0d14',
      'editor.foreground': '#e5e7eb',
    },
  });
};

interface DiffViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  originalLabel: string;
  modifiedLabel: string;
  original: string;
  modified: string;
  language?: string;
}

/** Side-by-side Monaco diff editor — used for version comparison and (later) snapshot comparison
 *  and general file-change review (spec §42). */
export function DiffViewerDialog({
  open,
  onOpenChange,
  title,
  originalLabel,
  modifiedLabel,
  original,
  modified,
  language = 'plaintext',
}: DiffViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-between px-1 text-xs text-muted-foreground">
          <span>{originalLabel}</span>
          <span>{modifiedLabel}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
          <DiffEditor
            original={original}
            modified={modified}
            language={language}
            theme={MINGO_DARK_DIFF_THEME}
            beforeMount={defineMingoDiffTheme}
            options={{
              readOnly: true,
              renderSideBySide: true,
              automaticLayout: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
