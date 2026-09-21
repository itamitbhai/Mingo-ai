import { Types } from 'mongoose';
import { CreateGithubRepoInput, GithubRepositoryQueryInput } from 'shared';
import { GitHubConnectionModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { getOctokitForUser, withGitHub } from './githubClient';

export interface RepositorySummary {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  updatedAt: string | null;
  owner: { login: string; avatarUrl: string };
}

export interface BranchSummary {
  name: string;
  commitSha: string;
  protected: boolean;
}

/** `:id`/`repositoryFullName` route params carry the URL-encoded `owner/repo` string (not GitHub's
 *  numeric repository id) — every subsequent operation needs both parts anyway, so this avoids a
 *  second lookup just to resolve one. */
export function splitFullName(fullName: string): { owner: string; repo: string } {
  const decoded = decodeURIComponent(fullName);
  const [owner, repo] = decoded.split('/');
  if (!owner || !repo) {
    throw ApiError.badRequest('Invalid repository identifier, expected "owner/repo".');
  }
  return { owner, repo };
}

function mapRepo(repo: any): RepositorySummary {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    htmlUrl: repo.html_url,
    description: repo.description,
    defaultBranch: repo.default_branch,
    language: repo.language,
    updatedAt: repo.updated_at,
    owner: { login: repo.owner.login, avatarUrl: repo.owner.avatar_url },
  };
}

export async function listRepositories(
  userId: Types.ObjectId,
  query: GithubRepositoryQueryInput
): Promise<{ items: RepositorySummary[]; page: number; limit: number }> {
  const octokit = await getOctokitForUser(userId);

  if (query.search) {
    const connection = await GitHubConnectionModel.findOne({ user: userId });
    if (!connection) throw ApiError.badRequest('Connect your GitHub account first.');

    return withGitHub(async () => {
      const { data } = await octokit.search.repos({
        q: `${query.search} user:${connection.username} in:name,description fork:true`,
        per_page: query.limit,
        page: query.page,
      });
      return { items: data.items.map(mapRepo), page: query.page, limit: query.limit };
    });
  }

  return withGitHub(async () => {
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: query.limit,
      page: query.page,
    });
    return { items: data.map(mapRepo), page: query.page, limit: query.limit };
  });
}

export async function getRepository(userId: Types.ObjectId, fullName: string): Promise<RepositorySummary> {
  const { owner, repo } = splitFullName(fullName);
  const octokit = await getOctokitForUser(userId);

  return withGitHub(async () => {
    const { data } = await octokit.repos.get({ owner, repo });
    return mapRepo(data);
  });
}

export async function listBranches(userId: Types.ObjectId, fullName: string): Promise<BranchSummary[]> {
  const { owner, repo } = splitFullName(fullName);
  const octokit = await getOctokitForUser(userId);

  return withGitHub(async () => {
    const branches = await octokit.paginate(octokit.repos.listBranches, { owner, repo, per_page: 100 });
    return branches.map((branch) => ({
      name: branch.name,
      commitSha: branch.commit.sha,
      protected: branch.protected,
    }));
  });
}

/** Creates a new branch directly on GitHub (via the Git Data API) rather than in a local working
 *  copy — useful before a project has ever been cloned/connected locally. Local branch create
 *  against the project's own working copy is a separate operation (Phase 12 Milestone 3). */
export async function createBranchOnRepo(
  userId: Types.ObjectId,
  fullName: string,
  name: string,
  fromBranch?: string
): Promise<BranchSummary> {
  const { owner, repo } = splitFullName(fullName);
  const octokit = await getOctokitForUser(userId);

  return withGitHub(async () => {
    const repoData = await octokit.repos.get({ owner, repo });
    const baseBranch = fromBranch || repoData.data.default_branch;

    const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });

    try {
      await octokit.git.createRef({ owner, repo, ref: `refs/heads/${name}`, sha: baseRef.data.object.sha });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 422) {
        throw ApiError.conflict(`Branch "${name}" already exists.`);
      }
      throw err;
    }

    return { name, commitSha: baseRef.data.object.sha, protected: false };
  });
}

export async function createRepository(userId: Types.ObjectId, input: CreateGithubRepoInput): Promise<RepositorySummary> {
  const octokit = await getOctokitForUser(userId);

  return withGitHub(async () => {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: input.name,
      description: input.description,
      private: input.private,
      auto_init: true,
    });
    return mapRepo(data);
  });
}
