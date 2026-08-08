'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useWorkspaceUIStore } from '@/store/use-workspace-ui-store';

interface EditorSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditorSettingsDialog({ open, onOpenChange }: EditorSettingsDialogProps) {
  const preferences = useWorkspaceUIStore((state) => state.editorPreferences);
  const setEditorPreferences = useWorkspaceUIStore((state) => state.setEditorPreferences);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editor Preferences</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="workspace-font-size">Font size</Label>
            <input
              id="workspace-font-size"
              type="number"
              min={10}
              max={24}
              value={preferences.fontSize}
              onChange={(event) => setEditorPreferences({ fontSize: Number(event.target.value) || 14 })}
              className="w-16 rounded-md border border-input bg-background/50 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="workspace-tab-size">Tab size</Label>
            <input
              id="workspace-tab-size"
              type="number"
              min={2}
              max={8}
              value={preferences.tabSize}
              onChange={(event) => setEditorPreferences({ tabSize: Number(event.target.value) || 2 })}
              className="w-16 rounded-md border border-input bg-background/50 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="workspace-word-wrap">Word wrap</Label>
            <Switch
              id="workspace-word-wrap"
              checked={preferences.wordWrap}
              onCheckedChange={(checked) => setEditorPreferences({ wordWrap: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="workspace-minimap">Minimap</Label>
            <Switch
              id="workspace-minimap"
              checked={preferences.minimap}
              onCheckedChange={(checked) => setEditorPreferences({ minimap: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="workspace-autosave">Auto save</Label>
            <Switch
              id="workspace-autosave"
              checked={preferences.autoSave}
              onCheckedChange={(checked) => setEditorPreferences({ autoSave: checked })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
