import { Request } from 'express';
import { UserDocument } from '../models/user.model';
import { ApiError } from './ApiError';

export function getCurrentUser(req: Request): UserDocument {
  if (!req.dbUser) {
    throw ApiError.unauthorized('You must be signed in to access this resource');
  }
  return req.dbUser;
}
