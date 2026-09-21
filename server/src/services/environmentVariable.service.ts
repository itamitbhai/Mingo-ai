import { FilterQuery, Types } from 'mongoose';
import { CreateEnvironmentVariableInput, DeploymentEnvironment, UpdateEnvironmentVariableInput } from 'shared';
import { EnvironmentVariableDocument, EnvironmentVariableModel } from '../models';
import { ApiError } from '../utils/ApiError';
import { decrypt, encrypt } from '../utils/crypto';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import { getProjectById } from './project.service';

const MASKED_VALUE = '••••••••';

export async function listEnvironmentVariables(
  owner: Types.ObjectId,
  projectId: string,
  environment?: DeploymentEnvironment
) {
  const project = await getProjectById(owner, projectId);
  const filter: FilterQuery<EnvironmentVariableDocument> = { project: project._id };
  if (environment) filter.environment = environment;

  const docs = await EnvironmentVariableModel.find(filter).sort({ environment: 1, key: 1 });

  // Values are never returned in a listing (spec §10) — only `revealEnvironmentVariable` (a
  // separate, explicit call) ever decrypts one.
  return docs.map((doc) => ({
    id: doc.id as string,
    key: doc.key,
    environment: doc.environment,
    value: MASKED_VALUE,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));
}

async function getOwnedVariable(owner: Types.ObjectId, projectId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest('Invalid environment variable id');
  }
  const project = await getProjectById(owner, projectId);
  const doc = await EnvironmentVariableModel.findOne({ _id: id, project: project._id });
  if (!doc) {
    throw ApiError.notFound('Environment variable not found');
  }
  return doc;
}

/** The one explicit "Reveal" path (spec §10) — every other read of this collection returns
 *  `MASKED_VALUE` instead. */
export async function revealEnvironmentVariable(owner: Types.ObjectId, projectId: string, id: string) {
  const project = await getProjectById(owner, projectId);
  const doc = await EnvironmentVariableModel.findOne({ _id: id, project: project._id }).select(
    '+encryptedValue +encryptedValueIv +encryptedValueAuthTag'
  );
  if (!doc?.encryptedValue || !doc.encryptedValueIv || !doc.encryptedValueAuthTag) {
    throw ApiError.notFound('Environment variable not found');
  }

  const value = decrypt({
    ciphertext: doc.encryptedValue,
    iv: doc.encryptedValueIv,
    authTag: doc.encryptedValueAuthTag,
  });

  return { id: doc.id as string, key: doc.key, environment: doc.environment, value };
}

export async function createEnvironmentVariable(
  owner: Types.ObjectId,
  projectId: string,
  data: CreateEnvironmentVariableInput
) {
  const project = await getProjectById(owner, projectId);
  const encrypted = encrypt(data.value);

  try {
    return await EnvironmentVariableModel.create({
      project: project._id,
      owner,
      environment: data.environment,
      key: data.key,
      encryptedValue: encrypted.ciphertext,
      encryptedValueIv: encrypted.iv,
      encryptedValueAuthTag: encrypted.authTag,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw ApiError.conflict(`"${data.key}" is already configured for ${data.environment}.`);
    }
    throw err;
  }
}

export async function updateEnvironmentVariable(
  owner: Types.ObjectId,
  projectId: string,
  id: string,
  data: UpdateEnvironmentVariableInput
) {
  const doc = await getOwnedVariable(owner, projectId, id);
  const encrypted = encrypt(data.value);

  doc.encryptedValue = encrypted.ciphertext;
  doc.encryptedValueIv = encrypted.iv;
  doc.encryptedValueAuthTag = encrypted.authTag;
  await doc.save();

  return doc;
}

export async function deleteEnvironmentVariable(owner: Types.ObjectId, projectId: string, id: string) {
  const doc = await getOwnedVariable(owner, projectId, id);
  await doc.deleteOne();
}

/** Internal-only — real decrypted key/value pairs for the deployment pipeline to hand to a provider
 *  (Milestone 3). Never exposed through a normal API response; callers must be server-side code that
 *  already resolved ownership. */
export async function getDecryptedEnvironmentVariables(
  owner: Types.ObjectId,
  projectId: string,
  environment: DeploymentEnvironment
): Promise<{ key: string; value: string }[]> {
  const project = await getProjectById(owner, projectId);
  const docs = await EnvironmentVariableModel.find({ project: project._id, environment }).select(
    '+encryptedValue +encryptedValueIv +encryptedValueAuthTag'
  );

  return docs.map((doc) => ({
    key: doc.key,
    value: decrypt({
      ciphertext: doc.encryptedValue!,
      iv: doc.encryptedValueIv!,
      authTag: doc.encryptedValueAuthTag!,
    }),
  }));
}
