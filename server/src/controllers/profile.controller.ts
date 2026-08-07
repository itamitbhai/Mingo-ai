import { Request, Response } from 'express';
import { UpdateProfileInput } from 'shared';
import * as userService from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  sendSuccess(res, user);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const body = req.body as UpdateProfileInput;

  const updated = await userService.updateProfile(user, body);
  sendSuccess(res, updated, 'Profile updated successfully');
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  await userService.deleteAccount(user);
  sendSuccess(res, null, 'Account deleted successfully');
});
