import { Octokit } from '@octokit/rest';
import { Types } from 'mongoose';
import { GitHubConnectionStatus } from 'shared';
import { GitHubConnectionModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { decrypt } from '../../utils/crypto';
import { logger } from '../../utils/logger';

interface OctokitErrorShape {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, string> };
}

/**
 * The single place a decrypted GitHub access token is ever materialized in memory (Phase 12
 * spec §5/§24/§25's "centralize authentication" rule) — every other GitHub service calls this
 * instead of touching `GitHubConnectionModel`'s token fields directly.
 */
export async function getOctokitForUser(userId: Types.ObjectId): Promise<Octokit> {
  const connection = await GitHubConnectionModel.findOne({
    user: userId,
    status: GitHubConnectionStatus.CONNECTED,
  }).select('+accessTokenEncrypted +accessTokenIv +accessTokenAuthTag');

  if (!connection?.accessTokenEncrypted || !connection.accessTokenIv || !connection.accessTokenAuthTag) {
    throw ApiError.badRequest('Connect your GitHub account first.');
  }

  const token = decrypt({
    ciphertext: connection.accessTokenEncrypted,
    iv: connection.accessTokenIv,
    authTag: connection.accessTokenAuthTag,
  });

  return new Octokit({ auth: token });
}

/**
 * Maps a real Octokit/GitHub API failure into a safe, user-facing `ApiError` (spec §35/§36) —
 * never a raw error object, never the underlying token, never a stack trace with request headers.
 */
export function toGithubApiError(err: unknown): ApiError {
  const shape = err as OctokitErrorShape;
  const status = shape?.status;

  if (status === 401) {
    return ApiError.unauthorized('Your GitHub connection has expired or been revoked. Please reconnect GitHub.');
  }
  if (status === 403) {
    const remaining = shape?.response?.headers?.['x-ratelimit-remaining'];
    if (remaining === '0') {
      return new ApiError(429, 'GitHub API rate limit reached. Please try again later.');
    }
    return ApiError.forbidden('GitHub denied this request. Check repository access/permissions.');
  }
  if (status === 404) {
    return ApiError.notFound('That GitHub resource was not found, or you do not have access to it.');
  }
  if (status === 409) {
    return ApiError.conflict(shape?.message || 'GitHub rejected this request due to a conflict.');
  }
  if (status === 422) {
    return ApiError.badRequest(shape?.message || 'GitHub rejected this request.');
  }

  logger.error('github.api.unexpected_error', { status, message: shape?.message });
  return ApiError.internal('The GitHub request failed. Please try again.');
}

export async function withGitHub<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toGithubApiError(err);
  }
}
