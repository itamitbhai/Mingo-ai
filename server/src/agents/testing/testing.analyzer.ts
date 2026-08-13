import { Types } from 'mongoose';
import { z } from 'zod';
import { ITestFailureAnalysis, ITestResult } from 'shared';
import { testingAgentConfig } from '../../config/testingAgent.config';
import * as aiService from '../../services/ai/ai.service';
import * as vfs from '../../services/workspace/virtual-file-system.service';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

const analysisSchema = z.object({
  summary: z.string().min(1),
  rootCause: z.string().min(1),
  affectedFile: z.string().optional(),
  why: z.string().min(1),
  recommendedFix: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
});

const CANDIDATE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
const MAX_SOURCE_FILES = 4;
const MAX_FILE_CONTENT = 8000;

/** Best-effort: resolves a relative import in the failing test file to a real path in the workspace
 *  by trying common extensions/index-file variants — `vfs.readFile` fails closed on any guess that
 *  doesn't exist, so a wrong guess is silently skipped rather than surfaced as an error. */
function candidateImportPaths(fromFile: string, importPath: string): string[] {
  const dir = fromFile.split('/').slice(0, -1);
  for (const part of importPath.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') dir.pop();
    else dir.push(part);
  }
  const base = dir.join('/');
  return CANDIDATE_EXTENSIONS.map((ext) => `${base}${ext}`);
}

async function loadRelevantSourceFiles(
  owner: Types.ObjectId,
  projectId: string,
  result: ITestResult
): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  const seen = new Set<string>();

  if (result.file) {
    const testFile = await vfs.readFile(owner, projectId, result.file).catch(() => null);
    if (testFile?.content) {
      files.push({ path: result.file, content: testFile.content.slice(0, MAX_FILE_CONTENT) });
      seen.add(result.file);

      const importMatches = testFile.content.matchAll(/from\s+['"](\.[^'"]+)['"]/g);
      for (const match of importMatches) {
        if (files.length >= MAX_SOURCE_FILES) break;

        for (const candidate of candidateImportPaths(result.file, match[1])) {
          if (seen.has(candidate)) break;
          const file = await vfs.readFile(owner, projectId, candidate).catch(() => null);
          if (file) {
            files.push({ path: candidate, content: file.content.slice(0, MAX_FILE_CONTENT) });
            seen.add(candidate);
            break;
          }
        }
      }
    }
  }

  return files;
}

function buildPrompt(
  result: ITestResult,
  sourceFiles: { path: string; content: string }[]
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are the Mingo AI Testing Engineer analyzing one failing automated test. Base your analysis only on the failure details and the real source files given below — never invent behavior you can't see evidence for. If the given files aren't enough to be certain of the root cause, say so honestly and set "confidence" to "low" rather than guessing with false certainty.

Respond with a single JSON object and nothing else, matching exactly this shape:
{ "summary": string, "rootCause": string, "affectedFile"?: string, "why": string, "recommendedFix": string, "confidence": "low" | "medium" | "high" }`;

  const userPrompt = `Failing test:
- suite: ${result.suite}
- test: ${result.test}
- file: ${result.file ?? '(unknown)'}
- error: ${result.error ?? '(no error message captured)'}
- stack: ${result.stack ?? '(none captured)'}
- expected: ${result.expected ?? '(none captured)'}
- actual: ${result.actual ?? '(none captured)'}

Relevant source files:
${sourceFiles.length ? sourceFiles.map((file) => `--- ${file.path} ---\n${file.content}`).join('\n\n') : '(none available — analyze from the failure details alone, and lower your confidence accordingly)'}

Analyze the real root cause now.`;

  return { systemPrompt, userPrompt };
}

/**
 * AI failure analysis for one failing `ITestResult` (Phase 9 spec §38/§39/§66) — read-only, never
 * writes a file. `confidence` is the concrete mechanism for "do not claim certainty if evidence is
 * insufficient" — the UI must render it, never hide it.
 */
export async function analyzeFailure(
  owner: Types.ObjectId,
  projectId: string,
  result: ITestResult,
  signal: AbortSignal
): Promise<ITestFailureAnalysis> {
  const sourceFiles = await loadRelevantSourceFiles(owner, projectId, result);
  const { systemPrompt, userPrompt } = buildPrompt(result, sourceFiles);

  const { content } = await aiService.generateStructuredCompletion({
    systemPrompt,
    userPrompt,
    signal,
    model: testingAgentConfig.MODEL,
    maxOutputTokens: 1000,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw ApiError.badRequest('The Testing Agent could not analyze this failure right now — please try again.');
  }

  const validated = analysisSchema.safeParse(parsed);
  if (!validated.success) {
    logger.warn('testing_agent.analyze.invalid_output', { issues: validated.error.issues });
    throw ApiError.badRequest('The Testing Agent could not analyze this failure right now — please try again.');
  }

  return validated.data;
}
