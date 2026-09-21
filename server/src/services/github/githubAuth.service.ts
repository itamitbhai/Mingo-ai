import { createHmac, randomBytes } from 'node:crypto';
import { Octokit } from '@octokit/rest';
import { Types } from 'mongoose';
import { GitHubConnectionStatus } from 'shared';
import { env } from '../../config/env';
import { GitHubConnectionModel } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { encrypt, safeEqual } from '../../utils/crypto';
import { logger } from '../../utils/logger';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const OAUTH_SCOPES = ['repo', 'read:user', 'user:email'];
const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  userId: string;
  nonce: string;
  exp: number;
}

function hmacKey(): Buffer {
  return Buffer.from(env.GITHUB_TOKEN_ENCRYPTION_KEY, 'base64');
}

/**
 * The OAuth callback lands on the Express backend as a plain top-level browser redirect from
 * github.com — it carries no Clerk session (different origin/port than the Next.js client), so
 * there is no `req.dbUser` to rely on there. Instead, the user's identity travels inside a signed,
 * short-lived `state` value that only this server could have produced — GitHub echoes it back
 * verbatim, so the callback can verify the signature and trust the embedded `userId` without any
 * server-side session store (spec §23's OAuth state validation).
 */
function createOAuthState(userId: string): string {
  const payload: OAuthStatePayload = { userId, nonce: randomBytes(16).toString('hex'), exp: Date.now() + STATE_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', hmacKey()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [payloadB64, signature] = state.split('.');
  if (!payloadB64 || !signature) return null;

  const expectedSignature = createHmac('sha256', hmacKey()).update(payloadB64).digest('base64url');
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (typeof payload.userId !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(userId: Types.ObjectId): string {
  const state = createOAuthState(userId.toString());
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GITHUB_CALLBACK_URL);
  url.searchParams.set('scope', OAUTH_SCOPES.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'false');
  return url.toString();
}

interface GithubTokenResponse {
  access_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/** Exchanges the OAuth `code` for an access token, fetches the GitHub identity, and stores the
 *  encrypted connection. Returns the Mingo `userId` the connection belongs to (recovered from the
 *  verified `state`) so the controller knows who to redirect. */
export async function handleCallback(code: string, state: string): Promise<{ userId: string; username: string }> {
  const verified = verifyOAuthState(state);
  if (!verified) {
    throw ApiError.badRequest('Invalid or expired GitHub authorization request. Please try connecting again.');
  }

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_CALLBACK_URL,
    }),
  });

  if (!tokenRes.ok) {
    logger.error('github.oauth.token_exchange_http_error', { status: tokenRes.status });
    throw ApiError.badRequest('GitHub authorization failed. Please try connecting again.');
  }

  const tokenBody = (await tokenRes.json()) as GithubTokenResponse;
  if (!tokenBody.access_token) {
    logger.error('github.oauth.no_access_token', { error: tokenBody.error });
    throw ApiError.badRequest(tokenBody.error_description || 'GitHub did not return an access token.');
  }

  const octokit = new Octokit({ auth: tokenBody.access_token });
  const { data: githubUser } = await octokit.users.getAuthenticated();

  const encrypted = encrypt(tokenBody.access_token);

  await GitHubConnectionModel.findOneAndUpdate(
    { user: verified.userId },
    {
      user: verified.userId,
      githubUserId: githubUser.id,
      username: githubUser.login,
      email: githubUser.email ?? undefined,
      avatarUrl: githubUser.avatar_url,
      accessTokenEncrypted: encrypted.ciphertext,
      accessTokenIv: encrypted.iv,
      accessTokenAuthTag: encrypted.authTag,
      scopes: (tokenBody.scope ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      status: GitHubConnectionStatus.CONNECTED,
      connectedAt: new Date(),
      lastSyncAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { userId: verified.userId, username: githubUser.login };
}

export async function getStatus(userId: Types.ObjectId) {
  const connection = await GitHubConnectionModel.findOne({ user: userId });

  if (!connection) {
    return { connected: false as const };
  }

  return {
    connected: connection.status === GitHubConnectionStatus.CONNECTED,
    username: connection.username,
    email: connection.email,
    avatarUrl: connection.avatarUrl,
    scopes: connection.scopes,
    status: connection.status,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
  };
}

/** Removes the stored connection/credentials but never touches Mingo projects or their files, and
 *  never calls GitHub to delete anything on the user's actual account (spec §37). */
export async function disconnect(userId: Types.ObjectId): Promise<void> {
  await GitHubConnectionModel.deleteOne({ user: userId });
}
