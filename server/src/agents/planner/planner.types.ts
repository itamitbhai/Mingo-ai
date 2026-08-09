export interface PlannerContextFile {
  path: string;
  type: string;
  language?: string;
}

export interface PlannerContextProject {
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

export interface PlannerContextWorkspace {
  status: string;
  activeVersion: number;
}

export interface PlannerContextManifest {
  framework: string;
  language: string;
  packageManager: string;
  files: number;
  folders: number;
  entryPoints: string[];
}

export interface PlannerContextDependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PlannerContextMessage {
  role: string;
  content: string;
}

/**
 * The shape passed into every planner prompt — built once per generation by
 * `agents/context/project-context.builder.ts` (spec §7). Deliberately metadata-first: `files` is
 * `{path, type, language}` only, never file content.
 */
export interface PlannerContext {
  project: PlannerContextProject;
  workspace: PlannerContextWorkspace | null;
  manifest: PlannerContextManifest | null;
  files: PlannerContextFile[];
  dependencies: PlannerContextDependencies;
  recentChanges: string[];
  conversation: PlannerContextMessage[];
}

export type PlannerStage =
  | 'loading_context'
  | 'generating'
  | 'validating'
  | 'retrying'
  | 'saving'
  | 'done'
  | 'error';

export interface PlannerStageEvent {
  stage: PlannerStage;
  label: string;
  attempt?: number;
}

export type OnPlannerStage = (event: PlannerStageEvent) => void;
