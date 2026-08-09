import { FilterQuery, Types } from 'mongoose';
import {
  ActivityType,
  CreateProjectInput,
  ProjectQueryInput,
  ProjectStatus,
  UpdateProjectInput,
} from 'shared';
import { ProjectDocument, ProjectModel } from '../models';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta } from '../utils/paginate';
import { logger } from '../utils/logger';
import { logActivity } from './activity.service';
import { createStarterFiles } from './templates/template.service';
import { ensureWorkspace } from './workspace/workspace.service';

const SORT_MAP: Record<ProjectQueryInput['sort'], Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
};

export async function listProjects(owner: Types.ObjectId, query: ProjectQueryInput) {
  const filter: FilterQuery<ProjectDocument> = { owner };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    filter.$text = { $search: query.search };
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    ProjectModel.find(filter)
      .sort(SORT_MAP[query.sort])
      .skip(skip)
      .limit(query.limit),
    ProjectModel.countDocuments(filter),
  ]);

  return {
    items,
    pagination: buildPaginationMeta(total, query.page, query.limit),
  };
}

export async function getProjectById(owner: Types.ObjectId, id: string) {
  const project = await ProjectModel.findOne({ _id: id, owner });

  if (!project) {
    throw ApiError.notFound('Project not found');
  }

  return project;
}

export async function createProject(owner: Types.ObjectId, data: CreateProjectInput) {
  const project = await ProjectModel.create({ ...data, owner });

  await logActivity(
    owner,
    ActivityType.PROJECT_CREATED,
    `Created project "${project.name}"`,
    { projectId: project._id.toString() }
  );

  try {
    await createStarterFiles(project._id, owner, project.frontend, project.backend);
    await ensureWorkspace(owner, project._id, project.frontend);
  } catch (err) {
    // The project itself was created successfully — a failed starter-file/workspace seed
    // shouldn't fail project creation. The workspace will just start empty; the user can still
    // create files, and `ensureWorkspace` is idempotent so it will self-heal on next access.
    logger.error('project.starterFiles.failed', err);
  }

  return project;
}

export async function updateProject(
  owner: Types.ObjectId,
  id: string,
  data: UpdateProjectInput
) {
  const project = await getProjectById(owner, id);

  Object.assign(project, data);
  await project.save();

  await logActivity(owner, ActivityType.PROJECT_UPDATED, `Updated project "${project.name}"`, {
    projectId: project._id.toString(),
  });

  return project;
}

export async function deleteProject(owner: Types.ObjectId, id: string) {
  const project = await getProjectById(owner, id);
  await project.deleteOne();

  await logActivity(owner, ActivityType.PROJECT_DELETED, `Deleted project "${project.name}"`, {
    projectId: id,
  });
}

export async function archiveProject(owner: Types.ObjectId, id: string) {
  const project = await getProjectById(owner, id);
  const isArchiving = project.status !== ProjectStatus.ARCHIVED;
  project.status = isArchiving ? ProjectStatus.ARCHIVED : ProjectStatus.ACTIVE;
  await project.save();

  await logActivity(
    owner,
    ActivityType.PROJECT_ARCHIVED,
    `${isArchiving ? 'Archived' : 'Restored'} project "${project.name}"`,
    { projectId: project._id.toString() }
  );

  return project;
}

export async function duplicateProject(owner: Types.ObjectId, id: string) {
  const original = await getProjectById(owner, id);

  const duplicate = await ProjectModel.create({
    name: `${original.name} (Copy)`,
    description: original.description,
    frontend: original.frontend,
    backend: original.backend,
    database: original.database,
    authentication: original.authentication,
    styling: original.styling,
    deployment: original.deployment,
    status: ProjectStatus.DRAFT,
    owner,
  });

  await logActivity(
    owner,
    ActivityType.PROJECT_DUPLICATED,
    `Duplicated project "${original.name}"`,
    { projectId: duplicate._id.toString(), sourceProjectId: original._id.toString() }
  );

  return duplicate;
}

export async function countProjectsForOwner(owner: Types.ObjectId) {
  return ProjectModel.countDocuments({ owner });
}
