import { Types } from 'mongoose';
import { UpdateSettingsInput } from 'shared';
import { SettingsModel } from '../models';

export async function getOrCreateSettings(userId: Types.ObjectId) {
  let settings = await SettingsModel.findOne({ user: userId });

  if (!settings) {
    settings = await SettingsModel.create({ user: userId });
  }

  return settings;
}

export async function updateSettings(userId: Types.ObjectId, data: UpdateSettingsInput) {
  const settings = await getOrCreateSettings(userId);

  if (data.theme) {
    settings.theme = data.theme;
  }

  if (data.notifications) {
    Object.assign(settings.notifications, data.notifications);
  }

  if (data.security) {
    Object.assign(settings.security, data.security);
  }

  await settings.save();
  return settings;
}
