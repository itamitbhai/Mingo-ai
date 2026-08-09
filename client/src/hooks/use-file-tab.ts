'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { detectLanguage } from 'shared';

import { ApiError } from '@/lib/api';
import * as fileService from '@/services/files/file.service';
import { fileCacheKey, useFileCacheStore } from '@/store/use-file-cache-store';
import { useWorkspaceUIStore } from '@/store/use-workspace-ui-store';

const AUTOSAVE_DELAY_MS = 1500;

/**
 * Saves whatever is currently cached for `path`, regardless of whether it's the active tab.
 * Standalone (not a hook) so it can also be called from the "unsaved changes" close-tab dialog
 * for a tab that isn't the one currently open in Monaco.
 */
export async function saveFileByPath(
  projectId: string,
  path: string,
  getToken: () => Promise<string | null>
): Promise<void> {
  const key = fileCacheKey(projectId, path);
  const store = useFileCacheStore.getState();
  const current = store.files[key];
  if (!current || current.isSaving || !current.isDirty) return;

  store.updateFile(key, { isSaving: true, saveError: false });

  try {
    const token = await getToken();
    const saved = await fileService.updateFileContent(
      projectId,
      { path, content: current.content, expectedVersion: current.version },
      token
    );

    store.updateFile(key, {
      version: saved.version,
      originalContent: current.content,
      isDirty: false,
      isSaving: false,
      saveError: false,
    });
  } catch (error) {
    store.updateFile(key, { isSaving: false, saveError: true });

    if (error instanceof ApiError && error.status === 409) {
      toast.error('This file was changed elsewhere. Reload before saving.', {
        action: {
          label: 'Reload',
          onClick: () => void reloadFileFromServer(projectId, path, getToken),
        },
      });
    } else {
      toast.error(error instanceof ApiError ? error.message : 'Save failed');
    }
  }
}

/** Discards local edits and re-fetches the latest server content for a tab — the "Reload" action
 *  on a save-conflict toast (spec §26/§43). */
export async function reloadFileFromServer(
  projectId: string,
  path: string,
  getToken: () => Promise<string | null>
): Promise<void> {
  const key = fileCacheKey(projectId, path);
  const store = useFileCacheStore.getState();

  try {
    const token = await getToken();
    const loaded = await fileService.getFileContent(projectId, path, token);

    store.setFile(key, {
      path,
      content: loaded.content,
      originalContent: loaded.content,
      version: loaded.version,
      language: loaded.language ?? detectLanguage(path),
      isBinary: loaded.isBinary ?? false,
      isDirty: false,
      isLoading: false,
      isSaving: false,
      saveError: false,
    });
    toast.success('Reloaded from server');
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : 'Failed to reload file');
  }
}

/** Owns loading, editing, saving, and autosaving for a single open tab's content. */
export function useFileTab(projectId: string, path: string | null) {
  const { getToken } = useAuth();
  const key = path ? fileCacheKey(projectId, path) : null;
  const file = useFileCacheStore((state) => (key ? state.files[key] : undefined));
  const setFile = useFileCacheStore((state) => state.setFile);
  const updateFile = useFileCacheStore((state) => state.updateFile);
  const autoSaveEnabled = useWorkspaceUIStore((state) => state.editorPreferences.autoSave);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTokenRef = useRef(0);

  useEffect(() => {
    if (!path || !key || file) return;

    const requestId = ++loadTokenRef.current;
    setFile(key, {
      path,
      content: '',
      originalContent: '',
      version: 0,
      language: detectLanguage(path),
      isBinary: false,
      isDirty: false,
      isLoading: true,
      isSaving: false,
      saveError: false,
    });

    (async () => {
      try {
        const token = await getToken();
        const loaded = await fileService.getFileContent(projectId, path, token);
        if (loadTokenRef.current !== requestId) return;

        setFile(key, {
          path,
          content: loaded.content,
          originalContent: loaded.content,
          version: loaded.version,
          language: loaded.language ?? detectLanguage(path),
          isBinary: loaded.isBinary ?? false,
          isDirty: false,
          isLoading: false,
          isSaving: false,
          saveError: false,
        });
      } catch (error) {
        if (loadTokenRef.current !== requestId) return;
        toast.error(error instanceof ApiError ? error.message : 'Failed to load file');
        updateFile(key, { isLoading: false });
      }
    })();
  }, [path, key, file, projectId, getToken, setFile, updateFile]);

  const save = useCallback(async () => {
    if (!path) return;
    await saveFileByPath(projectId, path, getToken);
  }, [path, projectId, getToken]);

  const updateContent = useCallback(
    (content: string) => {
      if (!key) return;
      const current = useFileCacheStore.getState().files[key];
      if (!current) return;

      updateFile(key, { content, isDirty: content !== current.originalContent });

      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (autoSaveEnabled) {
        autosaveTimer.current = setTimeout(() => {
          void save();
        }, AUTOSAVE_DELAY_MS);
      }
    },
    [key, updateFile, autoSaveEnabled, save]
  );

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  return { file, updateContent, save };
}
