import { Schema, model, Document, Types } from 'mongoose';
import { Theme } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface SettingsDocument extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  theme: Theme;
  notifications: {
    productUpdates: boolean;
    securityAlerts: boolean;
    projectActivity: boolean;
    weeklyDigest: boolean;
    marketingEmails: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<SettingsDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    theme: {
      type: String,
      enum: Object.values(Theme),
      default: Theme.DARK,
    },
    notifications: {
      productUpdates: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
      projectActivity: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
      marketingEmails: { type: Boolean, default: false },
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      lastPasswordChange: { type: Date },
    },
  },
  { timestamps: true }
);

applyToJSON(settingsSchema);

export const SettingsModel = model<SettingsDocument>('Settings', settingsSchema);
