import { Schema, model, Document, Types } from 'mongoose';
import { GitHubConnectionStatus } from 'shared';

/**
 * One user's account-level GitHub OAuth connection (Phase 12 spec §5) — one per Mingo user, reused
 * across every project they connect/import. The encrypted token fields are `select: false` so an
 * ordinary `.find()`/`.findOne()` never returns them; `githubAuth.service.ts` is the only caller
 * that ever explicitly `.select('+accessTokenEncrypted +accessTokenIv +accessTokenAuthTag')`s them,
 * and `applyToJSON` strips them again as defense in depth even if a future query forgets to omit
 * them (spec §23 — never expose the token to the frontend, logs, or API responses).
 */
export interface GitHubConnectionDocument extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  githubUserId: number;
  username: string;
  email?: string;
  avatarUrl?: string;
  accessTokenEncrypted?: string;
  accessTokenIv?: string;
  accessTokenAuthTag?: string;
  scopes: string[];
  status: GitHubConnectionStatus;
  connectedAt: Date;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const githubConnectionSchema = new Schema<GitHubConnectionDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    githubUserId: {
      type: Number,
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    avatarUrl: {
      type: String,
    },
    accessTokenEncrypted: {
      type: String,
      required: true,
      select: false,
    },
    accessTokenIv: {
      type: String,
      required: true,
      select: false,
    },
    accessTokenAuthTag: {
      type: String,
      required: true,
      select: false,
    },
    scopes: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(GitHubConnectionStatus),
      default: GitHubConnectionStatus.CONNECTED,
    },
    connectedAt: {
      type: Date,
      required: true,
    },
    lastSyncAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

githubConnectionSchema.index({ githubUserId: 1 });

// Same shape as `applyToJSON`, plus explicit deletion of the token fields as defense in depth
// (spec §23) — even if a future query explicitly re-selects them, they never survive serialization.
githubConnectionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.accessTokenEncrypted;
    delete ret.accessTokenIv;
    delete ret.accessTokenAuthTag;
    return ret;
  },
});

export const GitHubConnectionModel = model<GitHubConnectionDocument>(
  'GitHubConnection',
  githubConnectionSchema
);
