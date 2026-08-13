import { Types } from 'mongoose';
import { z } from 'zod';
import { AgentGenerationStatus, IFrontendOperation, ITestResult } from 'shared';
import { testingAgentConfig } from '../../config/testingAgent.config';
import { AgentGenerationDocument, AgentGenerationModel } from '../../models';
import * as aiService from '../../services/ai/ai.service';
import { getProjectById } from '../../services/project.service';
import * as usageService from '../../services/usage.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { previewTestingOperations } from './testing.operations';
import { testingFixOperationSchema } from './testing.schema';
import { isForbiddenPath, scanForSecrets } from './testing.security';

const MAX_FIX_FILES = 4;
const MAX_FILE_CONTENT = 10000;

const fixOutputSchema = z.object({
  operations: z.array(testingFixOperationSchema).min(1).max(MAX_FIX_FILES),
  notes: z.string().optional(),
});

/** Best-effort extraction of file paths named in a Node/Jest/Vitest stack trace — used only to widen
 *  the fix's allowed-file set beyond the failing test file itself (spec §38/§41). */
function extractPathsFromStack(stack: string | undefined): string[] {
  if (!stack) return [];

  const matches = stack.matchAll(/([a-zA-Z0-9_.\-/]+\.(?:tsx?|jsx?))(?::\d+)?/g);
  const paths = new Set<string>();

  for (const match of matches) {
    const candidate = match[1].replace(/^\.\//, '');
    if (!candidate.includes('node_modules')) paths.add(candidate);
  }

  return Array.from(paths);
}

/**
 * Generates a scoped fix for one failing test (Phase 9 spec §40/§41): the AI may only propose
 * `create`/`update` operations against a fixed, pre-computed allowlist — the failing test's own file
 * plus up to `MAX_FIX_FILES - 1` files named in its stack trace. Any operation the model returns
 * outside that set is rejected outright rather than silently dropped or widened. Produces a new
 * `AgentGeneration` (`status: PREVIEW_READY`) that flows through the existing, unmodified
 * `/workspace/ai/apply`/`/reject` endpoints — no new apply mechanism (spec §75).
 */
export async function generateFix(
  owner: Types.ObjectId,
  projectId: string,
  planId: Types.ObjectId,
  taskId: string,
  result: ITestResult,
  signal: AbortSignal
): Promise<AgentGenerationDocument> {
  const project = await getProjectById(owner, projectId);

  const allowedPaths = new Set<string>();
  if (result.file) allowedPaths.add(result.file);
  for (const path of extractPathsFromStack(result.stack)) {
    if (allowedPaths.size >= MAX_FIX_FILES) break;
    allowedPaths.add(path);
  }

  if (allowedPaths.size === 0) {
    throw ApiError.badRequest('Could not determine which file this failure belongs to — open the source file manually.');
  }

  const relevantFiles: { path: string; content: string }[] = [];
  for (const path of allowedPaths) {
    if (isForbiddenPath(path)) continue;
    const file = await vfs.readFile(owner, projectId, path).catch(() => null);
    if (file) relevantFiles.push({ path, content: file.content.slice(0, MAX_FILE_CONTENT) });
  }

  const systemPrompt = `You are the Mingo AI Testing Engineer generating a targeted fix for one failing automated test. You may ONLY modify the exact files listed under "Files you may modify" below — never propose any other path, never a wider rewrite than the failure requires. Return the FULL corrected content for every file you change, never a diff or a placeholder. Never touch environment files, secrets, or credentials, and never write a real secret/credential/API key/password into any file. Respond with a single JSON object and nothing else, matching exactly: { "operations": [{ "type": "update"|"create", "path": string, "content": string, "reason": string }], "notes"?: string }`;

  const userPrompt = `Failing test:
- suite: ${result.suite}
- test: ${result.test}
- error: ${result.error ?? '(none captured)'}
- stack: ${result.stack ?? '(none captured)'}
- expected: ${result.expected ?? '(none captured)'}
- actual: ${result.actual ?? '(none captured)'}

Files you may modify (propose no other path):
${Array.from(allowedPaths).join(', ')}

Current content of those files:
${relevantFiles.length ? relevantFiles.map((file) => `--- ${file.path} ---\n${file.content}`).join('\n\n') : '(none could be read — you may still propose a "create" for a listed path if that is the actual fix)'}

Produce the minimal fix now, as a single JSON object matching the required shape.`;

  const { content, usage } = await aiService.generateStructuredCompletion({
    systemPrompt,
    userPrompt,
    signal,
    model: testingAgentConfig.MODEL,
    maxOutputTokens: testingAgentConfig.MAX_GENERATION_TOKENS,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw ApiError.badRequest('The Testing Agent could not generate a fix right now — please try again.');
  }

  const validated = fixOutputSchema.safeParse(parsed);
  if (!validated.success) {
    logger.warn('testing_agent.fix.invalid_output', { issues: validated.error.issues });
    throw ApiError.badRequest('The Testing Agent could not generate a fix right now — please try again.');
  }

  const offending = validated.data.operations.filter((op) => !allowedPaths.has(op.path));
  if (offending.length > 0) {
    throw ApiError.badRequest('The generated fix touched files outside the failure\'s scope and was rejected.', {
      offendingPaths: offending.map((op) => op.path),
    });
  }

  for (const op of validated.data.operations) {
    if (isForbiddenPath(op.path)) {
      throw ApiError.badRequest(`"${op.path}" is a protected file and cannot be modified.`);
    }
    const secretIssues = scanForSecrets(op.content);
    if (secretIssues.length > 0) {
      throw ApiError.badRequest(`Generated fix for "${op.path}" was rejected: ${secretIssues.join('; ')}`);
    }
  }

  const operations: IFrontendOperation[] = validated.data.operations.map((op) => ({
    type: op.type,
    path: op.path,
    content: op.content,
    reason: op.reason,
  }));

  const { preview, operationsWithDiff } = await previewTestingOperations(owner, projectId, operations);
  if (!preview.valid) {
    throw ApiError.badRequest('The generated fix conflicts with the current workspace state — try again.', {
      errors: [...preview.errors, ...preview.conflicts],
    });
  }

  const latest = await AgentGenerationModel.findOne({ plan: planId, taskId }).sort({ version: -1 }).select('version');
  const version = (latest?.version ?? 0) + 1;

  const generation = await AgentGenerationModel.create({
    project: project._id,
    plan: planId,
    taskId,
    agentType: 'testing',
    version,
    status: AgentGenerationStatus.PREVIEW_READY,
    operations: operationsWithDiff,
    notes: validated.data.notes ?? `AI-generated fix for the failing test "${result.test}".`,
  });

  await usageService.recordUsage({
    userId: owner,
    projectId: project._id,
    modelName: testingAgentConfig.MODEL,
    purpose: 'testing_agent',
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  });

  logger.info('testing_agent.fix.generated', {
    projectId: project.id,
    taskId,
    generationId: generation.id,
    test: result.test,
  });

  return generation;
}
