'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import { toast } from 'sonner';
import { FileEntryType, type IFileTreeNode, type IProject } from 'shared';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useWorkspaceFiles } from '@/hooks/use-workspace-files';
import { saveFileByPath, useFileTab } from '@/hooks/use-file-tab';
import { useWorkspaceKeyboardShortcuts } from '@/hooks/use-workspace-keyboard-shortcuts';
import { formatDocument, isFormattableLanguage } from '@/lib/format-document';
import { fileCacheKey, useFileCacheStore } from '@/store/use-file-cache-store';
import { useWorkspaceUIStore } from '@/store/use-workspace-ui-store';
import type { AIContextAttachment, EditorProblem, FileStatus } from '@/types/workspace';
import { BottomPanel } from './BottomPanel';
import { CommandPalette } from './CommandPalette';
import { CreateEntryDialog, type CreateEntryState } from './CreateEntryDialog';
import { EditorSettingsDialog } from './EditorSettingsDialog';
import { EditorTabs } from './EditorTabs';
import { FileExplorer } from './FileExplorer';
import { MonacoEditorPane } from './MonacoEditorPane';
import { QuickFileSearch } from './QuickFileSearch';
import { WorkspaceChatPanel } from './WorkspaceChatPanel';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceSearchDialog } from './WorkspaceSearchDialog';

type EditorMarker = ReturnType<Monaco['editor']['getModelMarkers']>[number];

const SEVERITY_MAP: Record<number, EditorProblem['severity']> = { 8: 'error', 4: 'warning', 2: 'info', 1: 'info' };

function toEditorProblem(marker: EditorMarker): EditorProblem {
  return {
    filePath: marker.resource.path.replace(/^\//, ''),
    message: marker.message,
    severity: SEVERITY_MAP[marker.severity] ?? 'info',
    line: marker.startLineNumber,
    column: marker.startColumn,
  };
}

function findNode(nodes: IFileTreeNode[], path: string): IFileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

interface WorkspaceShellProps {
  projectId: string;
  project: Pick<IProject, 'name'>;
  initialTree: IFileTreeNode[];
}

export function WorkspaceShell({ projectId, project, initialTree }: WorkspaceShellProps) {
  const { getToken } = useAuth();
  const files = useWorkspaceFiles(projectId, initialTree);

  const isExplorerOpen = useWorkspaceUIStore((state) => state.isExplorerOpen);
  const isAIChatOpen = useWorkspaceUIStore((state) => state.isAIChatOpen);
  const isBottomPanelOpen = useWorkspaceUIStore((state) => state.isBottomPanelOpen);
  const toggleExplorer = useWorkspaceUIStore((state) => state.toggleExplorer);
  const toggleAIChat = useWorkspaceUIStore((state) => state.toggleAIChat);
  const toggleBottomPanel = useWorkspaceUIStore((state) => state.toggleBottomPanel);
  const openTabPaths = useWorkspaceUIStore((state) => state.getProjectUI(projectId).openTabPaths);
  const activeTabPath = useWorkspaceUIStore((state) => state.getProjectUI(projectId).activeTabPath);
  const openTab = useWorkspaceUIStore((state) => state.openTab);
  const closeTabAction = useWorkspaceUIStore((state) => state.closeTab);
  const closeOtherTabsAction = useWorkspaceUIStore((state) => state.closeOtherTabs);
  const closeAllTabsAction = useWorkspaceUIStore((state) => state.closeAllTabs);
  const setActiveTabAction = useWorkspaceUIStore((state) => state.setActiveTab);

  const filesCache = useFileCacheStore((state) => state.files);
  const { file: activeFile, updateContent, save } = useFileTab(projectId, activeTabPath);

  const [rootCreateState, setRootCreateState] = useState<CreateEntryState | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isWorkspaceSearchOpen, setIsWorkspaceSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [closeConfirmPath, setCloseConfirmPath] = useState<string | null>(null);
  const [problems, setProblems] = useState<EditorProblem[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<AIContextAttachment | null>(null);

  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const tabs = useMemo(
    () =>
      openTabPaths.map((path) => {
        const node = findNode(files.tree, path);
        return { path, name: node?.name ?? path.split('/').pop() ?? path, language: node?.language ?? 'plaintext' };
      }),
    [openTabPaths, files.tree]
  );

  const dirtyPaths = useMemo(() => {
    const dirty = new Set<string>();
    for (const path of openTabPaths) {
      if (filesCache[fileCacheKey(projectId, path)]?.isDirty) dirty.add(path);
    }
    return dirty;
  }, [openTabPaths, filesCache, projectId]);

  const saveStatus: FileStatus = !activeTabPath
    ? 'idle'
    : activeFile?.isLoading
      ? 'loading'
      : activeFile?.isSaving
        ? 'saving'
        : activeFile?.saveError
          ? 'error'
          : activeFile?.isDirty
            ? 'idle'
            : 'saved';

  function openFile(node: IFileTreeNode) {
    if (node.type !== FileEntryType.FILE) return;
    openTab(projectId, node.path);
  }

  function closeTabForReal(path: string) {
    closeTabAction(projectId, path);
    useFileCacheStore.getState().removeFile(fileCacheKey(projectId, path));
  }

  function requestCloseTab(path: string) {
    if (filesCache[fileCacheKey(projectId, path)]?.isDirty) {
      setCloseConfirmPath(path);
      return;
    }
    closeTabForReal(path);
  }

  function closeAllTabs() {
    const anyDirty = openTabPaths.some((path) => filesCache[fileCacheKey(projectId, path)]?.isDirty);
    if (anyDirty) {
      toast.error('Save or discard unsaved files before closing all tabs.');
      return;
    }
    closeAllTabsAction(projectId);
    openTabPaths.forEach((path) => useFileCacheStore.getState().removeFile(fileCacheKey(projectId, path)));
  }

  const handleEditorMount = useCallback((editorInstance: MonacoEditorNS.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    editorInstance.addAction({
      id: 'mingo.ask-ai',
      label: 'Ask Mingo AI',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const selection = ed.getSelection();
        const model = ed.getModel();
        if (!selection || !model) return;
        const code = model.getValueInRange(selection);
        if (!code.trim()) return;

        setPendingAttachment({
          filePath: activeTabPath ?? '',
          language: model.getLanguageId(),
          selectedCode: code,
        });
        if (!useWorkspaceUIStore.getState().isAIChatOpen) toggleAIChat();
      },
    });

    monaco.editor.onDidChangeMarkers(() => {
      setProblems(monaco.editor.getModelMarkers({}).map(toEditorProblem));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFormatDocument() {
    if (!activeFile || !activeTabPath) return;
    if (!isFormattableLanguage(activeFile.language)) {
      toast.error(`Formatting isn't supported for this file type yet.`);
      return;
    }
    try {
      const preferences = useWorkspaceUIStore.getState().editorPreferences;
      const formatted = await formatDocument(activeFile.content, activeFile.language, preferences.tabSize);
      updateContent(formatted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Formatting failed');
    }
  }

  function handleSelectProblem(filePath: string, line: number) {
    const node = findNode(files.tree, filePath);
    if (node) openFile(node);
    setTimeout(() => editorRef.current?.revealLineInCenter(line), 150);
  }

  useWorkspaceKeyboardShortcuts({
    onSave: () => void save(),
    onQuickFileSearch: () => setIsQuickSearchOpen(true),
    onCommandPalette: () => setIsCommandPaletteOpen(true),
    onWorkspaceSearch: () => setIsWorkspaceSearchOpen(true),
    onToggleExplorer: toggleExplorer,
    onToggleBottomPanel: toggleBottomPanel,
    onToggleAIChat: toggleAIChat,
    onCloseActiveTab: () => activeTabPath && requestCloseTab(activeTabPath),
    onFormatDocument: () => void handleFormatDocument(),
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-140 flex-col overflow-hidden rounded-2xl border border-border bg-card/40">
      <WorkspaceHeader
        projectId={projectId}
        projectName={project.name}
        saveStatus={saveStatus}
        isExplorerOpen={isExplorerOpen}
        isAIChatOpen={isAIChatOpen}
        isBottomPanelOpen={isBottomPanelOpen}
        onToggleExplorer={toggleExplorer}
        onToggleAIChat={toggleAIChat}
        onToggleBottomPanel={toggleBottomPanel}
        onSave={() => void save()}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={isBottomPanelOpen ? 70 : 100} minSize={30}>
          <ResizablePanelGroup direction="horizontal">
            {isExplorerOpen && (
              <>
                <ResizablePanel defaultSize={18} minSize={12} maxSize={35}>
                  <FileExplorer
                    projectId={projectId}
                    tree={files.tree}
                    activePath={activeTabPath}
                    onOpenFile={openFile}
                    onCreateFile={files.createFile}
                    onCreateFolder={files.createFolder}
                    onRename={files.rename}
                    onDelete={files.remove}
                    onAskAI={(attachment) => {
                      setPendingAttachment(attachment);
                      if (!useWorkspaceUIStore.getState().isAIChatOpen) toggleAIChat();
                    }}
                  />
                </ResizablePanel>
                <ResizableHandle />
              </>
            )}

            <ResizablePanel defaultSize={isAIChatOpen ? 55 : 82} minSize={30}>
              <div className="flex h-full flex-col">
                <EditorTabs
                  tabs={tabs}
                  dirtyPaths={dirtyPaths}
                  activePath={activeTabPath}
                  onSelect={(path) => setActiveTabAction(projectId, path)}
                  onClose={requestCloseTab}
                  onCloseOthers={(path) => closeOtherTabsAction(projectId, path)}
                  onCloseAll={closeAllTabs}
                />
                <div className="flex-1 overflow-hidden">
                  {activeTabPath ? (
                    <MonacoEditorPane file={activeFile} onChange={updateContent} onMount={handleEditorMount} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Select a file to start editing
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>

            {isAIChatOpen && (
              <>
                <ResizableHandle />
                <ResizablePanel defaultSize={27} minSize={20} maxSize={45}>
                  <WorkspaceChatPanel
                    projectId={projectId}
                    currentFile={activeTabPath && activeFile ? { path: activeTabPath, language: activeFile.language } : null}
                    pendingAttachment={pendingAttachment}
                    onClearAttachment={() => setPendingAttachment(null)}
                    onClose={toggleAIChat}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>

        {isBottomPanelOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={15} maxSize={60}>
              <BottomPanel problems={problems} logs={[]} onSelectProblem={handleSelectProblem} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onNewFile={() => setRootCreateState({ parentPath: '', type: FileEntryType.FILE })}
        onNewFolder={() => setRootCreateState({ parentPath: '', type: FileEntryType.FOLDER })}
        onSave={() => void save()}
        onCloseFile={() => activeTabPath && requestCloseTab(activeTabPath)}
        onCloseAllTabs={closeAllTabs}
        onSearchFiles={() => setIsQuickSearchOpen(true)}
        onSearchWorkspace={() => setIsWorkspaceSearchOpen(true)}
        onToggleSidebar={toggleExplorer}
        onToggleAIChat={toggleAIChat}
        onToggleBottomPanel={toggleBottomPanel}
        onFormatDocument={() => void handleFormatDocument()}
      />

      <QuickFileSearch
        open={isQuickSearchOpen}
        onOpenChange={setIsQuickSearchOpen}
        tree={files.tree}
        onSelect={openFile}
      />

      <WorkspaceSearchDialog
        open={isWorkspaceSearchOpen}
        onOpenChange={setIsWorkspaceSearchOpen}
        projectId={projectId}
        onSelect={(path) => {
          const node = findNode(files.tree, path);
          if (node) openFile(node);
        }}
      />

      <EditorSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      <CreateEntryDialog
        state={rootCreateState}
        onOpenChange={(open) => !open && setRootCreateState(null)}
        onSubmit={async (name) => {
          if (!rootCreateState) return false;
          const ok =
            rootCreateState.type === FileEntryType.FILE
              ? await files.createFile(name)
              : await files.createFolder(name);
          if (ok) setRootCreateState(null);
          return ok;
        }}
      />

      <Dialog open={Boolean(closeConfirmPath)} onOpenChange={(open) => !open && setCloseConfirmPath(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save changes before closing?</DialogTitle>
            <DialogDescription>
              {closeConfirmPath ? `"${closeConfirmPath}" has unsaved changes.` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirmPath(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (closeConfirmPath) closeTabForReal(closeConfirmPath);
                setCloseConfirmPath(null);
              }}
            >
              Discard
            </Button>
            <Button
              onClick={async () => {
                if (closeConfirmPath) {
                  await saveFileByPath(projectId, closeConfirmPath, getToken);
                  closeTabForReal(closeConfirmPath);
                }
                setCloseConfirmPath(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
