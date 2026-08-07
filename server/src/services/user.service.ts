import { clerkClient } from '@clerk/express';
import { Types } from 'mongoose';
import { ActivityType, UpdateProfileInput } from 'shared';
import {
  ActivityModel,
  DeploymentModel,
  ProjectModel,
  SettingsModel,
  UserDocument,
  UserModel,
} from '../models';
import { logActivity } from './activity.service';

export async function updateProfile(user: UserDocument, data: UpdateProfileInput) {
  Object.assign(user, data);
  await user.save();

  await logActivity(user._id, ActivityType.PROFILE_UPDATED, 'Updated profile information');

  return user;
}

export async function deleteAccount(user: UserDocument) {
  const userId = user._id as Types.ObjectId;
  const projectIds = await ProjectModel.find({ owner: userId }).distinct('_id');

  await Promise.all([
    DeploymentModel.deleteMany({ project: { $in: projectIds } }),
    ProjectModel.deleteMany({ owner: userId }),
    SettingsModel.deleteMany({ user: userId }),
    ActivityModel.deleteMany({ user: userId }),
  ]);

  await UserModel.deleteOne({ _id: userId });

  try {
    await clerkClient.users.deleteUser(user.clerkId);
  } catch {
    // The Clerk-side identity may already be gone (e.g. deleted from the Clerk
    // dashboard directly); the local cascade above is the source of truth.
  }
}
