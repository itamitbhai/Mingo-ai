import { Types } from 'mongoose';
import { MessageStatus } from 'shared';
import * as fileTreeService from '../../services/files/file-tree.service';
import * as messageService from '../../services/message.service';
import * as projectService from '../../services/project.service';
import * as workspaceActivityService from '../../services/workspace/workspace-activity.service';
import * as workspaceService from '../../services/workspace/workspace.service';
import { PlannerContextFile, PlannerContextMessage } from '../planner/planner.types';

const MAX_CONTEXT_FILES = 300;
const MAX_RECENT_CHANGES = 15;
const MAX_CONVERSATION_MESSAGES = 10;

/**
 * Thin loaders over the existing Phase 1-4 services — this module never queries a Mongoose model
 * directly, it composes what `project.service`/`workspace.service`/`fileTreeService`/
 * `workspace-activity.service`/`message.service` already expose.
 */
export async function loadProject(owner: Types.ObjectId, projectId: string) {
  return projectService.getProjectById(owner, projectId);
}

export async function loadWorkspace(owner: Types.ObjectId, project: Types.ObjectId, framework: string) {
  return workspaceService.ensureWorkspace(owner, project, framework);
}

export async function loadManifest(owner: Types.ObjectId, projectId: string) {
  return workspaceService.getManifest(owner, projectId);
}

type FileTreeNode = Awaited<ReturnType<typeof fileTreeService.getFileTree>>[number];

function flattenTree(nodes: FileTreeNode[], acc: PlannerContextFile[] = []): PlannerContextFile[] {
  for (const node of nodes) {
    acc.push({ path: node.path, type: node.type, language: node.language as string | undefined });
    if (node.children?.length) {
      flattenTree(node.children, acc);
    }
  }
  return acc;
}

/** Metadata only (path/type/language) — never file content (spec §7). */
export async function loadFiles(owner: Types.ObjectId, projectId: string): Promise<PlannerContextFile[]> {
  const tree = await fileTreeService.getFileTree(owner, projectId);
  return flattenTree(tree).slice(0, MAX_CONTEXT_FILES);
}

export async function loadRecentChanges(owner: Types.ObjectId, project: Types.ObjectId): Promise<string[]> {
  const { items } = await workspaceActivityService.listActivity(project, owner, undefined, MAX_RECENT_CHANGES);
  return items.map((item) => item.description);
}

/** Last few non-failed/cancelled messages of a conversation, trimmed — never the full history
 *  (spec §55: "do not send unlimited conversation history"). */
export async function loadConversationMessages(
  conversationId: Types.ObjectId
): Promise<PlannerContextMessage[]> {
  const { items } = await messageService.listMessages(conversationId, { limit: MAX_CONVERSATION_MESSAGES });

  return items
    .filter((message) => message.status !== MessageStatus.FAILED && message.status !== MessageStatus.CANCELLED)
    .map((message) => ({ role: message.role, content: message.content.slice(0, 1000) }));
}
