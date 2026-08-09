import { Types } from 'mongoose';
import * as fileService from '../files/file.service';
import * as fileTreeService from '../files/file-tree.service';
import { moveEntry } from './move.service';
import { workspaceCache } from './cache.service';
import { getManifest } from './workspace.service';

/**
 * The single, agent-ready entry point for everything workspace-related (spec §3/§28). Future AI
 * agents (planner, frontend/backend/database agents, code generation) call these methods —
 * `readFile`, `writeFile`, `createFile`, `deleteFile`, `move`, `listFiles`, `search`, `snapshot` —
 * and never touch `ProjectFileModel`/MongoDB or the real OS filesystem directly. It's a thin
 * composition layer over the already-versioned/checksummed/activity-logged `file.service.ts` and
 * `move.service.ts`, not a second implementation of file I/O.
 */
export async function readFile(owner: Types.ObjectId, projectId: string, path: string) {
  return fileService.getFileContent(owner, projectId, path);
}

export async function writeFile(
  owner: Types.ObjectId,
  projectId: string,
  path: string,
  content: string,
  expectedVersion?: number
) {
  const exists = await fileService.getFileContent(owner, projectId, path).catch(() => null);
  if (!exists) {
    return fileService.createFile(owner, projectId, path, content);
  }
  return fileService.updateFileContent(owner, projectId, path, content, expectedVersion);
}

export async function createFile(owner: Types.ObjectId, projectId: string, path: string, content = '') {
  return fileService.createFile(owner, projectId, path, content);
}

export async function createFolder(owner: Types.ObjectId, projectId: string, path: string) {
  return fileService.createFolder(owner, projectId, path);
}

export async function deleteFile(owner: Types.ObjectId, projectId: string, path: string) {
  return fileService.deleteEntry(owner, projectId, path);
}

export async function move(owner: Types.ObjectId, projectId: string, path: string, destinationPath: string) {
  const { entry } = await moveEntry(owner, projectId, path, destinationPath);
  return entry;
}

export async function exists(owner: Types.ObjectId, projectId: string, path: string): Promise<boolean> {
  return fileService
    .getFileContent(owner, projectId, path)
    .then(() => true)
    .catch(() => false);
}

export async function listFiles(owner: Types.ObjectId, projectId: string) {
  return fileTreeService.getFileTree(owner, projectId);
}

export async function search(owner: Types.ObjectId, projectId: string, query: string) {
  return fileService.searchFiles(owner, projectId, query);
}

export async function getWorkspaceSnapshot(owner: Types.ObjectId, projectId: string) {
  const [tree, manifest] = await Promise.all([
    fileTreeService.getFileTree(owner, projectId),
    getManifest(owner, projectId),
  ]);
  return { tree, manifest };
}

export function invalidateCache(projectId: string): void {
  workspaceCache.invalidate(projectId);
}
