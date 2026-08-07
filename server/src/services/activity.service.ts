import { Types } from 'mongoose';
import { ActivityType } from 'shared';
import { ActivityModel } from '../models';

export async function logActivity(
  userId: Types.ObjectId,
  type: ActivityType,
  message: string,
  metadata?: Record<string, unknown>
) {
  return ActivityModel.create({ user: userId, type, message, metadata });
}

export async function listRecentActivity(userId: Types.ObjectId, limit = 8) {
  return ActivityModel.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
}
