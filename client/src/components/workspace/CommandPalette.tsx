'use client';

import {
  FilePlus,
  FolderPlus,
  MessageSquare,
  Navigation,
  PanelBottom,
  PanelLeft,
  Save,
  Search,
  SearchCode,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onSave: () => void;
  onCloseFile: () => void;
  onCloseAllTabs: () => void;
  onSearchFiles: () => void;
  onSearchWorkspace: () => void;
  onToggleSidebar: () => void;
  onToggleAIChat: () => void;
  onToggleBottomPanel: () => void;
  onFormatDocument: () => void;
}

export function CommandPalette({ open, onOpenChange, ...actions }: CommandPaletteProps) {
  function run(fn: () => void) {
    onOpenChange(false);
    fn();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Run a workspace command"
    >
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="File">
          <CommandItem onSelect={() => run(actions.onNewFile)}>
            <FilePlus className="size-4" /> New File
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onNewFolder)}>
            <FolderPlus className="size-4" /> New Folder
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onSave)}>
            <Save className="size-4" /> Save File
            <CommandShortcut>Ctrl+S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onCloseFile)}>
            <X className="size-4" /> Close File
            <CommandShortcut>Ctrl+W</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onCloseAllTabs)}>
            <XCircle className="size-4" /> Close All Tabs
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onFormatDocument)}>
            <Wand2 className="size-4" /> Format Document
            <CommandShortcut>Shift+Alt+F</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Search">
          <CommandItem onSelect={() => run(actions.onSearchFiles)}>
            <Search className="size-4" /> Search Files
            <CommandShortcut>Ctrl+P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onSearchFiles)}>
            <Navigation className="size-4" /> Go to File
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onSearchWorkspace)}>
            <SearchCode className="size-4" /> Search Workspace
            <CommandShortcut>Ctrl+Shift+F</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="View">
          <CommandItem onSelect={() => run(actions.onToggleSidebar)}>
            <PanelLeft className="size-4" /> Toggle Sidebar
            <CommandShortcut>Ctrl+B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onToggleAIChat)}>
            <MessageSquare className="size-4" /> Toggle AI Chat
            <CommandShortcut>Ctrl+Shift+A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(actions.onToggleBottomPanel)}>
            <PanelBottom className="size-4" /> Toggle Bottom Panel
            <CommandShortcut>Ctrl+J</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
