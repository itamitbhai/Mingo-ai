import { Types } from 'mongoose';
import { DeploymentConfigInput, DeploymentEnvironment } from 'shared';
import { DeploymentConfigModel } from '../models';
import { getProjectById } from './project.service';

export async function getDeploymentConfig(
  owner: Types.ObjectId,
  projectId: string,
  environment: DeploymentEnvironment
) {
  const project = await getProjectById(owner, projectId);
  return DeploymentConfigModel.findOne({ project: project._id, environment });
}

export async function listDeploymentConfigs(owner: Types.ObjectId, projectId: string) {
  const project = await getProjectById(owner, projectId);
  return DeploymentConfigModel.find({ project: project._id }).sort({ environment: 1 });
}

/** Upsert (spec §5's "Save Configuration") — one document per `{project, environment}`, enforced by
 *  the model's unique index; `findOneAndUpdate` with `upsert: true` makes repeated saves idempotent
 *  rather than erroring on the second save. */
export async function upsertDeploymentConfig(
  owner: Types.ObjectId,
  projectId: string,
  data: DeploymentConfigInput
) {
  const project = await getProjectById(owner, projectId);

  return DeploymentConfigModel.findOneAndUpdate(
    { project: project._id, environment: data.environment },
    { $set: { ...data, project: project._id, owner } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}
