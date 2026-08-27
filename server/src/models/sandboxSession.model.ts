import { Schema, model, Document, Types } from 'mongoose';
import { SandboxStatus } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

/**
 * One sandboxed command execution (Phase 11) — merges the spec's `SandboxSession` and
 * `TerminalSession` into a single document, since a sandbox in this design never outlives the one
 * command it runs (spec §6's lifecycle is create → run one command → destroy, never a long-lived
 * container reused across multiple commands). A "terminal" in the UI is simply a scrollback of these,
 * queried by project — not a separate persisted session object.
 */
export interface SandboxSessionDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  status: SandboxStatus;
  command: string;
  args: string[];
  containerId?: string;
  image?: string;
  exitCode?: number;
  logs: { stdout: string; stderr: string; truncated: boolean };
  resourceLimits: { memoryMb: number; cpuCores: number; pidsLimit: number };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sandboxSessionSchema = new Schema<SandboxSessionDocument>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SandboxStatus),
      default: SandboxStatus.CREATING,
    },
    command: { type: String, required: true, maxlength: 100 },
    // A fixed allowlisted-binary argv array, never free-form shell text — safe to store as-is
    // (spec §56: never store passwords/tokens/secrets/URIs, which this structurally can't contain).
    args: { type: [String], default: [] },
    containerId: { type: String },
    image: { type: String },
    exitCode: { type: Number },
    logs: {
      stdout: { type: String, default: '' },
      stderr: { type: String, default: '' },
      truncated: { type: Boolean, default: false },
    },
    resourceLimits: {
      memoryMb: { type: Number, required: true },
      cpuCores: { type: Number, required: true },
      pidsLimit: { type: Number, required: true },
    },
    error: { type: String, maxlength: 1000 },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

sandboxSessionSchema.index({ project: 1, createdAt: -1 });
applyToJSON(sandboxSessionSchema);

export const SandboxSessionModel = model<SandboxSessionDocument>('SandboxSession', sandboxSessionSchema);
