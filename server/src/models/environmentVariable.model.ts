import { Schema, model, Document, Types } from 'mongoose';
import { DeploymentEnvironment } from 'shared';

/**
 * A project's encrypted environment variable (Phase 13 spec §9/§29) — `encryptedValue`/`iv`/
 * `authTag` are `select: false` (same pattern as `githubConnection.model.ts`'s token fields) so an
 * ordinary query never returns the secret; `services/deploymentSecrets/environmentVariable.
 * service.ts` is the only caller that explicitly re-selects them, via the same `utils/crypto.ts`
 * AES-256-GCM helpers Phase 12 built for GitHub tokens. Values are never returned to the frontend
 * except through the explicit "reveal" path (spec §10).
 */
export interface EnvironmentVariableDocument extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  environment: DeploymentEnvironment;
  key: string;
  encryptedValue?: string;
  encryptedValueIv?: string;
  encryptedValueAuthTag?: string;
  createdAt: Date;
  updatedAt: Date;
}

const environmentVariableSchema = new Schema<EnvironmentVariableDocument>(
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
    environment: {
      type: String,
      enum: Object.values(DeploymentEnvironment),
      required: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    encryptedValue: {
      type: String,
      required: true,
      select: false,
    },
    encryptedValueIv: {
      type: String,
      required: true,
      select: false,
    },
    encryptedValueAuthTag: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

environmentVariableSchema.index({ project: 1, environment: 1, key: 1 }, { unique: true });

// Same defense-in-depth shape as `githubConnection.model.ts` — never serialize the secret even if a
// future query forgets to omit it.
environmentVariableSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.encryptedValue;
    delete ret.encryptedValueIv;
    delete ret.encryptedValueAuthTag;
    return ret;
  },
});

export const EnvironmentVariableModel = model<EnvironmentVariableDocument>(
  'EnvironmentVariable',
  environmentVariableSchema
);
