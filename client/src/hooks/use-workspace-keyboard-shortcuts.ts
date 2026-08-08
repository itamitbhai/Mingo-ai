'use client';

import { useEffect } from 'react';

export interface WorkspaceShortcutHandlers {
  onSave: () => void;
  onQuickFileSearch: () => void;
  onCommandPalette: () => void;
  onWorkspaceSearch: () => void;
  onToggleExplorer: () => void;
  onToggleBottomPanel: () => void;
  onToggleAIChat: () => void;
  onCloseActiveTab: () => void;
  onFormatDocument: () => void;
}

/** Global workspace shortcuts (spec section 39). Mount only while the workspace route is active. */
export function useWorkspaceKeyboardShortcuts(handlers: WorkspaceShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      // Shift+Alt+F — Format Document (no Ctrl/Cmd, matches VS Code).
      if (!isMod && event.shiftKey && event.altKey && key === 'f') {
        event.preventDefault();
        handlers.onFormatDocument();
        return;
      }

      if (!isMod) return;

      switch (key) {
        case 's':
          event.preventDefault();
          handlers.onSave();
          break;
        case 'p':
          event.preventDefault();
          if (event.shiftKey) {
            handlers.onCommandPalette();
          } else {
            handlers.onQuickFileSearch();
          }
          break;
        case 'f':
          if (event.shiftKey) {
            event.preventDefault();
            handlers.onWorkspaceSearch();
          }
          break;
        case 'b':
          event.preventDefault();
          handlers.onToggleExplorer();
          break;
        case 'j':
          event.preventDefault();
          handlers.onToggleBottomPanel();
          break;
        case 'a':
          if (event.shiftKey) {
            event.preventDefault();
            handlers.onToggleAIChat();
          }
          break;
        case 'w':
          event.preventDefault();
          handlers.onCloseActiveTab();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
