import { RequestHandler } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { UserModel } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { isDuplicateKeyError } from '../utils/mongoErrors';

/** Rejects the request unless Clerk has authenticated the caller. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const auth = getAuth(req);

  if (!auth?.userId) {
    return next(ApiError.unauthorized('You must be signed in to access this resource'));
  }

  next();
};

/**
 * Resolves the Clerk identity to a local `User` document, creating one on first
 * sight. Normal sync happens via the Clerk webhook (see webhook.controller.ts);
 * this is a just-in-time fallback so the API works even before a webhook fires
 * (e.g. local development without a configured webhook endpoint).
 */
export const loadUser = asyncHandler(async (req, _res, next) => {
  const auth = getAuth(req);

  if (!auth?.userId) {
    throw ApiError.unauthorized('You must be signed in to access this resource');
  }

  let user = await UserModel.findOne({ clerkId: auth.userId });

  if (!user) {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const primaryEmail =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      throw ApiError.badRequest('Your account is missing a verified email address');
    }

    try {
      user = await UserModel.create({
        clerkId: clerkUser.id,
        email: primaryEmail,
        firstName: clerkUser.firstName || 'there',
        lastName: clerkUser.lastName || '',
        avatarUrl: clerkUser.imageUrl,
        workspace: `${clerkUser.firstName ?? 'My'}'s Workspace`,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        user = await UserModel.findOne({ clerkId: auth.userId });
      } else {
        throw err;
      }
    }
  }

  if (!user) {
    throw ApiError.internal('Failed to resolve the signed-in user');
  }

  req.dbUser = user;
  next();
});
