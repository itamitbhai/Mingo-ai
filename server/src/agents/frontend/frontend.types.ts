import { IPlanTask } from 'shared';

export interface FrontendContextProject {
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

export interface FrontendContextManifest {
  framework: string;
  language: string;
  packageManager: string;
  files: number;
  folders: number;
  entryPoints: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface FrontendContextFile {
  path: string;
  content: string;
}

/**
 * The shape passed into every Frontend Agent prompt — unlike `PlannerContext` (metadata-only,
 * `agents/planner/planner.types.ts`), `relevantFiles` here carries actual file *content*, since the
 * agent needs to read existing components/conventions to generate consistent code. Never includes
 * a file `isForbiddenPath` rejects (spec §14).
 */
export interface FrontendAgentContext {
  project: FrontendContextProject;
  manifest: FrontendContextManifest | null;
  task: IPlanTask;
  relevantFiles: FrontendContextFile[];
  existingPaths: string[];
  feedback?: string;
}

export type FrontendStage =
  | 'loading_context'
  | 'reading_files'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'retrying'
  | 'preview_ready'
  | 'done'
  | 'error';

export interface FrontendStageEvent {
  stage: FrontendStage;
  label: string;
  attempt?: number;
}

export type OnFrontendStage = (event: FrontendStageEvent) => void;
