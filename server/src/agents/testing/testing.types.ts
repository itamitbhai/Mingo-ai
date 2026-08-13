import { IApiContract, IDatabaseSchemaContract, IPlanTask } from 'shared';

export interface TestingContextProject {
  id: string;
  name: string;
  description: string;
  frontend: string;
  backend: string;
  database: string;
  authentication: string;
  styling: string;
  deployment: string;
}

export interface TestingContextManifest {
  framework: string;
  language: string;
  packageManager: string;
  files: number;
  folders: number;
  entryPoints: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface TestingContextFile {
  path: string;
  content: string;
}

/**
 * The shape passed into every Testing Agent prompt — mirrors `DatabaseAgentContext`
 * (`agents/database/database.types.ts`) exactly, plus:
 * - `existingTestFiles`: every already-existing `*.test.*`/`*.spec.*`/`__tests__/`/`tests/` path
 *   (spec §52) — extend these instead of duplicating them.
 * - `backendApiContracts`/`databaseSchemaContracts`: the Backend/Database Agents' already-implemented
 *   contracts for this plan (spec §71), so generated tests assert against the real API/schema instead
 *   of an invented one (spec §72's contract-mismatch detection depends on the model actually being
 *   given the real contract to compare against).
 */
export interface TestingAgentContext {
  project: TestingContextProject;
  manifest: TestingContextManifest | null;
  task: IPlanTask;
  relevantFiles: TestingContextFile[];
  existingTestFiles: string[];
  existingPaths: string[];
  backendApiContracts: IApiContract[];
  databaseSchemaContracts: IDatabaseSchemaContract[];
  feedback?: string;
}

export type TestingStage =
  | 'loading_context'
  | 'reading_files'
  | 'reading_contracts'
  | 'detecting_framework'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'retrying'
  | 'preview_ready'
  | 'done'
  | 'error';

export interface TestingStageEvent {
  stage: TestingStage;
  label: string;
  attempt?: number;
}

export type OnTestingStage = (event: TestingStageEvent) => void;

/** Progress stages for actually *running* tests (spec §33) — distinct from `TestingStage` above,
 *  which is generation-time only. */
export type TestRunStage = 'preparing' | 'installing' | 'running' | 'collecting' | 'completed' | 'error';

export interface TestRunStageEvent {
  stage: TestRunStage;
  label: string;
}

export type OnTestRunStage = (event: TestRunStageEvent) => void;
