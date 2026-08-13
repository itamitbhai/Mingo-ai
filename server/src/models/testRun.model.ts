import { Schema, model, Document, Types } from 'mongoose';
import { ICoverageSummary, ITestResult, ITestRunScope, ITestRunSummary, TestRunStatus } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/**
 * One real execution of a project's tests (Phase 9) — structurally distinct from `AgentGeneration`
 * (a file-change proposal, one row per generation attempt) and `TaskExecution` (a single mutex row
 * per `{plan, taskId}`, never widened to carry run detail). A task can have many `TestRun`s over
 * time (re-runs, regression passes after a fix); `TaskExecution.latestGenerationId` keeps pointing at
 * the Testing Agent's latest *generation*, unrelated to how many times its tests have been run since.
 *
 * `results`/`logs.stdout`/`logs.stderr` are capped (see `testing.runner`/`result-parser`) — this is
 * process output, not something to store unbounded.
 */
export interface TestRunDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  plan: Types.ObjectId;
  taskId: string;
  generationId?: Types.ObjectId;
  status: TestRunStatus;
  scope: ITestRunScope;
  command?: string;
  summary?: ITestRunSummary;
  results: ITestResult[];
  coverage?: ICoverageSummary;
  logs: { stdout: string; stderr: string; truncated: boolean };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Enforced at the application layer (`testing.runner.ts` slices before saving), not via a schema
 *  validator — see the comment on `results` below for why. */
export const MAX_TEST_RESULTS = 500;

const testRunSchema = new Schema<TestRunDocument>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectPlan',
      required: true,
    },
    taskId: {
      type: String,
      required: true,
    },
    generationId: {
      type: Schema.Types.ObjectId,
      ref: 'AgentGeneration',
    },
    status: {
      type: String,
      enum: Object.values(TestRunStatus),
      default: TestRunStatus.QUEUED,
    },
    scope: { type: Schema.Types.Mixed, default: 'all' },
    command: { type: String, maxlength: 500 },
    summary: { type: Schema.Types.Mixed },
    // A single `Mixed` field holding an array — same convention as `agentGeneration.model.ts`'s
    // `operations`/`schemaContracts` — rather than `[Schema.Types.Mixed]`, which Mongoose's own
    // typings resolve ambiguously against its `Schema[]` overload.
    results: { type: Schema.Types.Mixed, default: [] },
    coverage: { type: Schema.Types.Mixed },
    logs: {
      stdout: { type: String, default: '' },
      stderr: { type: String, default: '' },
      truncated: { type: Boolean, default: false },
    },
    error: { type: String, maxlength: 1000 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

testRunSchema.index({ plan: 1, taskId: 1, createdAt: -1 });
testRunSchema.index({ project: 1, createdAt: -1 });
applyToJSON(testRunSchema);

export const TestRunModel = model<TestRunDocument>('TestRun', testRunSchema);
