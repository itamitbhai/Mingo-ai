import { Types } from 'mongoose';
import { PLAN_LIMITS, PlanType, ProjectStatus } from 'shared';
import { DeploymentModel, ProjectModel, UserDocument } from '../models';
import { listRecentActivity } from './activity.service';

export async function getDashboardOverview(user: UserDocument) {
  const owner = user._id as Types.ObjectId;

  const [totalProjects, activeProjects, archivedProjects, totalDeployments, recentProjects, recentActivity] =
    await Promise.all([
      ProjectModel.countDocuments({ owner }),
      ProjectModel.countDocuments({ owner, status: ProjectStatus.ACTIVE }),
      ProjectModel.countDocuments({ owner, status: ProjectStatus.ARCHIVED }),
      DeploymentModel.countDocuments({ owner }),
      ProjectModel.find({ owner }).sort({ updatedAt: -1 }).limit(5),
      listRecentActivity(owner, 8),
    ]);

  const plan = (user.plan ?? PlanType.FREE) as PlanType;
  const limit = PLAN_LIMITS[plan].projects;
  const usagePercentage =
    limit === Infinity ? 0 : Math.min(Math.round((totalProjects / limit) * 100), 100);

  return {
    stats: {
      totalProjects,
      activeProjects,
      archivedProjects,
      totalDeployments,
      plan,
      planLabel: PLAN_LIMITS[plan].label,
      projectLimit: limit === Infinity ? null : limit,
      usagePercentage,
    },
    recentProjects,
    recentActivity,
  };
}
