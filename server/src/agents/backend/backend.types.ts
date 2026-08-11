import { IPlanTask } from 'shared';

export interface BackendContextProject {
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

export interface BackendContextManifest {
  framework: string;
  language: string;
  packageManager: string;
  files: number;
  folders: number;
  entryPoints: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface BackendContextFile {
  path: string;
  content: string;
}

/** A single approved API endpoint from the Planner's `ProjectPlan.api` (spec §24/§27) — the
 *  contract the Backend Agent must implement exactly, not invent around. */
export interface BackendContextApiEndpoint {
  method: string;
  path: string;
  purpose: string;
  authRequired: boolean;
  requestSummary?: string;
  responseSummary?: string;
}

/**
 * The shape passed into every Backend Agent prompt — mirrors `FrontendAgentContext`
 * (`agents/frontend/frontend.types.ts`) exactly, plus `apiEndpoints`: the slice of the Planner's
 * approved API surface relevant to this task, so generated routes match the contract instead of
 * inventing endpoints (spec §12/§25).
 */
export interface BackendAgentContext {
  project: BackendContextProject;
  manifest: BackendContextManifest | null;
  task: IPlanTask;
  relevantFiles: BackendContextFile[];
  existingPaths: string[];
  apiEndpoints: BackendContextApiEndpoint[];
  feedback?: string;
}

export type BackendStage =
  | 'loading_context'
  | 'reading_files'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'retrying'
  | 'preview_ready'
  | 'done'
  | 'error';

export interface BackendStageEvent {
  stage: BackendStage;
  label: string;
  attempt?: number;
}

export type OnBackendStage = (event: BackendStageEvent) => void;
