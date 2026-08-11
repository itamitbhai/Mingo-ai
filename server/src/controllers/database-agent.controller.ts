import { Request, Response } from 'express';
import * as databaseAgentService from '../agents/database/database.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { getCurrentUser } from '../utils/getCurrentUser';

/**
 * Read-only database schema metadata (Phase 8 spec §76) — derived entirely from this project's own
 * `completed` Database Agent generations, never a live query against a real MongoDB server.
 */
export const getSchema = asyncHandler(async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const schema = await databaseAgentService.getProjectDatabaseSchema(user._id, req.params.projectId);
  sendSuccess(res, schema);
});
