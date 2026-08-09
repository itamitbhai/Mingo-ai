import { Types } from 'mongoose';
import { WorkspaceActivityAction } from 'shared';
import { WorkspaceActivityModel } from '../../models';

interface LogActivityInput {
  project: Types.ObjectId;
  user: Types.ObjectId;
  file?: Types.ObjectId;
  action: WorkspaceActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
}

/** Workspace-scoped activity log, distinct from the top-level `activity.service.ts` (project-level
 *  events like "created project") — this one is file/folder-operation history for the History panel
 *  and future AI agents (spec §21/§22). */
export async function logActivity(input: LogActivityInput) {
  return WorkspaceActivityModel.create(input);
}

export async function listActivity(
  project: Types.ObjectId,
  owner: Types.ObjectId,
  cursor: string | undefined,
  limit: number
) {
  const filter: Record<string, unknown> = { project, user: owner };

  if (cursor) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await WorkspaceActivityModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1);

  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit);

  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]._id.toString() : null,
  };
}
