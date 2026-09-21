import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { FileEntryType } from 'shared';
import { ProjectModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import * as fileTreeService from '../files/file-tree.service';
import { isForbiddenPath } from '../sandbox/sandbox.security';
import * as vfs from '../workspace/virtual-file-system.service';
import { getOctokitForUser, withGitHub } from '../github/githubClient';

export interface DriftResult {
  clean: boolean;
  branch: string;
  headCommitSha: string;
  differingPaths: string[];
  totalDifferingCount: number;
  truncated: boolean;
  checkedFileCount: number;
}

type FileTreeNode = Awaited<ReturnType<typeof fileTreeService.getFileTree>>[number];

/** Same tree-flattening shape as `services/sandbox/materializer.service.ts`'s private helper —
 *  duplicated rather than exported, matching this codebase's own stated convention of keeping each
 *  module's small helpers local (see `sandbox/sandbox.security.ts`'s comment on why its denylist is
 *  duplicated rather than shared). */
function flattenFilePaths(nodes: FileTreeNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === FileEntryType.FILE) {
      acc.push(node.path);
    }
    if (node.children?.length) {
      flattenFilePaths(node.children as FileTreeNode[], acc);
    }
  }
  return acc;
}

/** The real git object-hashing algorithm (`git hash-object`) — a git blob's SHA-1 is
 *  `sha1("blob " + byteLength + "\0" + content)`. This is what lets a Mongo-VFS file be compared
 *  directly against a GitHub tree entry's own `sha` with no local `.git` and no network fetch of the
 *  remote file's actual content (spec §16's Context decision #1). Binary files are hashed over
 *  `file.content` exactly as `materializer.service.ts` already treats them elsewhere in this
 *  codebase (as a plain UTF-8 string) — not a regression introduced here. */
export function computeGitBlobSha(content: string): string {
  const bytes = Buffer.from(content, 'utf8');
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(Buffer.concat([header, bytes])).digest('hex');
}

interface GitTreeEntry {
  path?: string;
  sha?: string;
  type?: string;
}

/**
 * Real, non-mocked "is this project's workspace clean relative to GitHub" check (Phase 13 spec §16)
 * — used to gate deployment without needing Phase 12's full local git working copy. Requires the
 * project to already be connected to a GitHub repository (`project.github.connected`); a project
 * that was never connected has nothing to compare against and can't be deployed via a git-based
 * provider either way.
 */
export async function checkDrift(
  owner: Types.ObjectId,
  projectId: string,
  branchOverride?: string
): Promise<DriftResult> {
  const project = await ProjectModel.findOne({ _id: projectId, owner });
  if (!project) {
    throw ApiError.notFound('Project not found');
  }
  if (!project.github?.connected || !project.github.repositoryFullName) {
    throw ApiError.badRequest('Connect this project to a GitHub repository before deploying.');
  }

  const branch = branchOverride || project.github.currentBranch || project.github.defaultBranch;
  if (!branch) {
    throw ApiError.badRequest('No branch is configured for this project.');
  }

  const [repoOwner, repoName] = project.github.repositoryFullName.split('/');
  const octokit = await getOctokitForUser(owner);

  const { tree, headCommitSha, truncated } = await withGitHub(async () => {
    const branchRef = await octokit.repos.getBranch({ owner: repoOwner, repo: repoName, branch });
    const commitSha = branchRef.data.commit.sha;
    const treeResponse = await octokit.git.getTree({
      owner: repoOwner,
      repo: repoName,
      tree_sha: commitSha,
      recursive: 'true',
    });
    return {
      tree: treeResponse.data.tree as GitTreeEntry[],
      headCommitSha: commitSha,
      truncated: Boolean(treeResponse.data.truncated),
    };
  });

  const remoteBlobShaByPath = new Map<string, string>();
  for (const entry of tree) {
    if (entry.type === 'blob' && entry.path && entry.sha) {
      remoteBlobShaByPath.set(entry.path, entry.sha);
    }
  }

  const fileTree = await fileTreeService.getFileTree(owner, projectId);
  const localPaths = flattenFilePaths(fileTree).filter((path) => !isForbiddenPath(path));

  const differingPaths: string[] = [];
  for (const path of localPaths) {
    const file = await vfs.readFile(owner, projectId, path).catch(() => null);
    if (!file) continue;

    const localSha = computeGitBlobSha(file.content ?? '');
    const remoteSha = remoteBlobShaByPath.get(path);

    if (remoteSha !== localSha) {
      differingPaths.push(path);
    }
  }

  return {
    clean: differingPaths.length === 0,
    branch,
    headCommitSha,
    differingPaths: differingPaths.slice(0, 50),
    totalDifferingCount: differingPaths.length,
    truncated,
    checkedFileCount: localPaths.length,
  };
}
