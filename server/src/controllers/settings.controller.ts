import { Request, Response } from 'express';
import { UpdateSettingsInput } from 'shared';
import * as settingsService from '../services/settings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const settings = await settingsService.getOrCreateSettings(user._id);
  sendSuccess(res, settings);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as UpdateSettingsInput;

  const settings = await settingsService.updateSettings(user._id, body);
  sendSuccess(res, settings, 'Settings updated successfully');
});
