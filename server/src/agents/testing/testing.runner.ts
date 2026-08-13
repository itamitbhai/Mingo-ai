import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { Types } from 'mongoose';
import { ICoverageSummary, ITestResult, ITestRunScope, ITestRunSummary, TestResultStatus, TestRunStatus } from 'shared';
import { testingAgentConfig } from '../../config/testingAgent.config';
import { MAX_TEST_RESULTS, TestRunDocument } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import * as commandService from '../../services/sandbox/command.service';
import * as materializer from '../../services/sandbox/materializer.service';
import * as resultParser from '../../services/sandbox/result-parser.service';
import * as runnerService from '../../services/sandbox/runner.service';
import { DetectedTestCommand, ScopedTestCommand } from '../../services/sandbox/sandbox.types';
import { OnTestRunStage, TestRunStage } from './testing.types';

function emit(onStage: OnTestRunStage | undefined, stage: TestRunStage, label: string) {
  onStage?.({ stage, label });
}

/**
 * Narrows the discovered commands to what the requested `ITestRunScope` asks for (spec §62).
 * `'failed'` intentionally degrades to running everything (`'all'`) for this pass — reliably mapping
 * "only the previously-failed tests" onto each framework's own CLI filter flags is fragile across
 * Jest/Vitest and out of scope for the vertical slice; a single test *file* (the fix-and-rerun loop's
 * actual requirement, spec §42) is fully supported below.
 */
function filterByScope(commands: DetectedTestCommand[], scope: ITestRunScope): ScopedTestCommand[] {
  if (scope === 'all' || scope === 'failed') return commands;

  if (typeof scope === 'object' && 'file' in scope) {
    const match = commands.find((command) => (command.cwd ? scope.file.startsWith(`${command.cwd}/`) : true));
    if (!match) return [];
    const relative = match.cwd ? scope.file.slice(match.cwd.length + 1) : scope.file;
    return [{ ...match, extraArgs: [relative] }];
  }

  const matches = commands.filter((command) => command.script.includes(scope));
  return matches.length > 0 ? matches : commands;
}

function summarize(results: ITestResult[]): ITestRunSummary {
  const passed = results.filter((result) => result.status === TestResultStatus.PASSED).length;
  const failed = results.filter((result) => result.status === TestResultStatus.FAILED).length;
  const skipped = results.filter((result) => result.status === TestResultStatus.SKIPPED).length;
  const durationMs = results.reduce((sum, result) => sum + (result.duration ?? 0), 0);
  return { passed, failed, skipped, total: results.length, durationMs };
}

/**
 * Runs the full sandbox pipeline for one `TestRun` (spec §30/§33): materialize → discover commands →
 * install → execute → parse → persist → cleanup. Every field written back onto `testRun` traces back
 * to a real process (`runnerService.runProcess`'s actual `exitCode`) or a real parsed reporter file —
 * nothing here is simulated (spec §85). The temp directory is always removed in `finally`, even on
 * timeout/cancel/crash.
 */
export async function executeTestRun(
  testRun: TestRunDocument,
  owner: Types.ObjectId,
  projectId: string,
  signal: AbortSignal,
  onStage?: OnTestRunStage
): Promise<TestRunDocument> {
  testRun.status = TestRunStatus.PREPARING;
  testRun.startedAt = new Date();
  await testRun.save();
  emit(onStage, 'preparing', 'Preparing test environment…');

  let workspace: Awaited<ReturnType<typeof materializer.materializeWorkspace>> | null = null;

  try {
    workspace = await materializer.materializeWorkspace(owner, projectId);

    const allCommands = await commandService.discoverTestCommands(workspace.dir);
    const commands = filterByScope(allCommands, testRun.scope);

    if (commands.length === 0) {
      throw ApiError.badRequest(
        'No test command was found for this project — apply generated tests first, or add a "test" script to package.json.'
      );
    }

    testRun.command = commands
      .map((command) => `npm run ${command.script}${command.cwd ? ` (in ${command.cwd})` : ''}`)
      .join('; ');
    await testRun.save();

    testRun.status = TestRunStatus.INSTALLING;
    await testRun.save();
    emit(onStage, 'installing', 'Installing dependencies…');

    const installedDirs = new Set<string>();
    for (const command of commands) {
      const dir = path.join(workspace.dir, command.cwd);
      if (installedDirs.has(dir) || signal.aborted) continue;
      installedDirs.add(dir);

      const useLockfile = await commandService.hasLockfile(dir);
      await runnerService.runProcess({
        cwd: dir,
        command: 'npm',
        args: useLockfile
          ? ['ci', '--no-audit', '--no-fund', '--prefer-offline']
          : ['install', '--no-audit', '--no-fund', '--prefer-offline'],
        timeoutMs: testingAgentConfig.TEST_INSTALL_TIMEOUT_MS,
        maxOutputChars: testingAgentConfig.TEST_RUN_MAX_OUTPUT_CHARS,
        signal,
      });
    }

    testRun.status = TestRunStatus.RUNNING;
    await testRun.save();
    emit(onStage, 'running', 'Running tests…');

    const allResults: ITestResult[] = [];
    let stdout = '';
    let stderr = '';
    let truncated = false;
    let overallExitCode = 0;
    let timedOut = false;
    let coverage: ICoverageSummary | undefined;

    for (const command of commands) {
      if (signal.aborted) break;

      const dir = path.join(workspace.dir, command.cwd);
      const reportPath = materializer.scratchFilePath('.json');
      const reporterArgs = commandService.buildReporterArgs(command.framework, reportPath);
      const extraArgs = [...reporterArgs, ...(command.extraArgs ?? [])];

      const result = await runnerService.runProcess({
        cwd: dir,
        command: 'npm',
        args: ['run', command.script, ...(extraArgs.length ? ['--', ...extraArgs] : [])],
        timeoutMs: testingAgentConfig.TEST_RUN_TIMEOUT_MS,
        maxOutputChars: testingAgentConfig.TEST_RUN_MAX_OUTPUT_CHARS,
        signal,
      });

      stdout += `\n--- ${command.cwd || '.'} (npm run ${command.script}) ---\n${result.stdout}`;
      stderr += result.stderr;
      truncated = truncated || result.truncated;
      timedOut = timedOut || result.timedOut;
      if (result.exitCode) overallExitCode = result.exitCode;

      const reportRaw = await readFile(reportPath, 'utf8').catch(() => null);
      if (reportRaw) {
        allResults.push(...resultParser.parseJestLikeReport(reportRaw, dir));
        await rm(reportPath, { force: true }).catch(() => undefined);
      }

      const coverageRaw = await readFile(path.join(dir, 'coverage', 'coverage-summary.json'), 'utf8').catch(
        () => null
      );
      if (coverageRaw) {
        coverage = resultParser.parseCoverageSummary(coverageRaw) ?? coverage;
      }
    }

    if (signal.aborted) {
      testRun.status = TestRunStatus.CANCELLED;
    } else if (timedOut) {
      testRun.status = TestRunStatus.TIMEOUT;
    } else {
      testRun.status = overallExitCode === 0 ? TestRunStatus.PASSED : TestRunStatus.FAILED;
    }

    emit(onStage, 'collecting', 'Collecting results…');

    testRun.summary = allResults.length > 0 ? summarize(allResults) : undefined;
    testRun.results = allResults.slice(0, MAX_TEST_RESULTS);
    testRun.coverage = coverage;
    testRun.logs = {
      stdout: stdout.slice(-testingAgentConfig.TEST_RUN_MAX_OUTPUT_CHARS),
      stderr: stderr.slice(-testingAgentConfig.TEST_RUN_MAX_OUTPUT_CHARS),
      truncated,
    };
    testRun.completedAt = new Date();
    await testRun.save();

    logger.info('testing_agent.test_run.completed', {
      testRunId: testRun.id,
      status: testRun.status,
      resultsCount: allResults.length,
    });
    emit(onStage, 'completed', 'Test run completed.');

    return testRun;
  } catch (err) {
    testRun.status = signal.aborted ? TestRunStatus.CANCELLED : TestRunStatus.ERROR;
    testRun.error = (err instanceof Error ? err.message : 'Test execution failed').slice(0, 1000);
    testRun.completedAt = new Date();
    await testRun.save();
    logger.error('testing_agent.test_run.failed', {
      testRunId: testRun.id,
      error: err instanceof Error ? err.message : err,
    });
    throw err;
  } finally {
    await workspace?.cleanup();
  }
}
