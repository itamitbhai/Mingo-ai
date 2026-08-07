import { Schema, model, Document, Types } from 'mongoose';
import { PlanType } from 'shared';
import { applyToJSON } from '../utils/applyToJSON';

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  bio?: string;
  workspace: string;
  plan: PlanType;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
      maxlength: 280,
    },
    workspace: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    plan: {
      type: String,
      enum: Object.values(PlanType),
      default: PlanType.FREE,
    },
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });
applyToJSON(userSchema);

export const UserModel = model<UserDocument>('User', userSchema);
