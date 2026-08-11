import { IApiContract, IPlanDatabase, IPlanTask } from 'shared';

export interface DatabaseContextProject {
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

export interface DatabaseContextManifest {
  framework: string;
  language: string;
  packageManager: string;
  files: number;
  folders: number;
  entryPoints: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface DatabaseContextFile {
  path: string;
  content: string;
}

/**
 * The shape passed into every Database Agent prompt — mirrors `BackendAgentContext`
 * (`agents/backend/backend.types.ts`) exactly, plus:
 * - `planDatabase`: the Planner's approved `ProjectPlan.database` (entities/relationships), the
 *   primary source of truth for what fields/relations this task should design (spec §13).
 * - `backendApiContracts`: every `apiContracts` entry from this plan's already-run Backend Agent
 *   generations (spec §25/§26) — what the schema needs to support to stay compatible.
 * - `requiredFieldPlan`: `database.planner.ts`'s merge of the two above into one required-field
 *   list per model, shown to the AI directly so it doesn't have to re-derive it.
 */
export interface DatabaseAgentContext {
  project: DatabaseContextProject;
  manifest: DatabaseContextManifest | null;
  task: IPlanTask;
  relevantFiles: DatabaseContextFile[];
  existingPaths: string[];
  planDatabase: IPlanDatabase | null;
  backendApiContracts: IApiContract[];
  requiredFieldPlan: RequiredFieldPlan[];
  feedback?: string;
}

export interface RequiredFieldPlan {
  model: string;
  requiredFields: string[];
}

export type DatabaseStage =
  | 'loading_context'
  | 'reading_files'
  | 'reading_backend_contract'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'retrying'
  | 'preview_ready'
  | 'done'
  | 'error';

export interface DatabaseStageEvent {
  stage: DatabaseStage;
  label: string;
  attempt?: number;
}

export type OnDatabaseStage = (event: DatabaseStageEvent) => void;
