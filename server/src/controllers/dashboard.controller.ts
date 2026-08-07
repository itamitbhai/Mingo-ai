import { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const overview = await dashboardService.getDashboardOverview(user);
  sendSuccess(res, overview);
});
