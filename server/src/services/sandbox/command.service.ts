import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DetectedFramework, DetectedTestCommand } from './sandbox.types';

/**
 * Detects which `package.json` test script to run — and never anything else (spec §31/§32/§61).
 * `SCRIPT_PRIORITY` is a fixed, hardcoded list of *known script names*; the AI or the user can pick
 * *which* known script runs (via a `TestType` scope), never supply an arbitrary command string. The
 * actual npm invocation (`command.service`'s consumer, `testing.runner.ts`) only ever passes one of
 * these constants as `npm run <name>` — nothing derived from untrusted file content ever reaches a
 * shell.
 */
const SCRIPT_PRIORITY = ['test', 'test:unit', 'test:ci', 'test:api', 'test:integration', 'test:component'];

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'out']);
const MAX_DEPTH = 2;

function detectFramework(
  dependencies: Record<string, string> = {},
  devDependencies: Record<string, string> = {}
): DetectedFramework {
  const all = { ...dependencies, ...devDependencies };
  if (all.vitest) return 'vitest';
  if (all.jest) return 'jest';
  if (all.mocha) return 'mocha';
  return 'unknown';
}

interface PackageJsonShape {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function detectTestCommandFromPackageJson(
  packageJsonPath: string,
  raw: string
): DetectedTestCommand | null {
  let parsed: PackageJsonShape;
  try {
    parsed = JSON.parse(raw) as PackageJsonShape;
  } catch {
    return null;
  }

  const scripts = parsed.scripts ?? {};
  const script = SCRIPT_PRIORITY.find((name) => typeof scripts[name] === 'string');
  if (!script) return null;

  const cwd = packageJsonPath === 'package.json' ? '' : packageJsonPath.replace(/\/package\.json$/, '');

  return {
    cwd,
    packageJsonPath,
    script,
    framework: detectFramework(parsed.dependencies, parsed.devDependencies),
  };
}

async function findPackageJsonFiles(dir: string, depth: number, root: string, acc: string[]): Promise<void> {
  if (depth > MAX_DEPTH) return;

  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'package.json') {
      acc.push(path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/'));
    } else if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
      await findPackageJsonFiles(path.join(dir, entry.name), depth + 1, root, acc);
    }
  }
}

/** Scans the materialized workspace (root + up to two levels deep, skipping `node_modules`/build
 *  output) for every `package.json` that declares a known test script — a generated monorepo-style
 *  project (separate frontend/backend package.json, mirroring Mingo's own repo layout) yields one
 *  command per location. */
export async function discoverTestCommands(workspaceDir: string): Promise<DetectedTestCommand[]> {
  const packageJsonPaths: string[] = [];
  await findPackageJsonFiles(workspaceDir, 0, workspaceDir, packageJsonPaths);

  const commands: DetectedTestCommand[] = [];
  for (const relativePath of packageJsonPaths) {
    const raw = await readFile(path.join(workspaceDir, relativePath), 'utf8').catch(() => null);
    if (!raw) continue;

    const detected = detectTestCommandFromPackageJson(relativePath, raw);
    if (detected) commands.push(detected);
  }

  return commands;
}

export async function hasLockfile(dir: string): Promise<boolean> {
  return stat(path.join(dir, 'package-lock.json'))
    .then(() => true)
    .catch(() => false);
}

/** Appends a JSON reporter flag only for a recognized framework — an unrecognized/`unknown`
 *  framework runs exactly the script as declared, with no assumptions about its CLI (spec §85: only
 *  ever report what a real reporter or exit code produced). */
export function buildReporterArgs(framework: DetectedFramework, reportPath: string): string[] {
  if (framework === 'jest') return ['--json', `--outputFile=${reportPath}`];
  if (framework === 'vitest') return ['--reporter=json', `--outputFile=${reportPath}`];
  return [];
}
