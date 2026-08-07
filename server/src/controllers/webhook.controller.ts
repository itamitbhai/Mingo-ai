import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { UserModel } from '../models';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { isDuplicateKeyError } from '../utils/mongoErrors';

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserWebhookData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

interface ClerkWebhookEnvelope {
  type: string;
  data: unknown;
}

function verifyClerkWebhook(req: Request): ClerkWebhookEnvelope {
  const svixId = req.header('svix-id');
  const svixTimestamp = req.header('svix-timestamp');
  const svixSignature = req.header('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw ApiError.badRequest('Missing Svix headers');
  }

  const webhook = new Webhook(env.CLERK_WEBHOOK_SECRET);

  return webhook.verify(req.body as Buffer, {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as ClerkWebhookEnvelope;
}

async function syncUserUpserted(data: ClerkUserWebhookData) {
  const { id, email_addresses, first_name, last_name, image_url, primary_email_address_id } = data;

  const primaryEmail =
    email_addresses.find((address) => address.id === primary_email_address_id)?.email_address ??
    email_addresses[0]?.email_address;

  if (!primaryEmail) {
    logger.warn(`Clerk webhook for user ${id} has no email address, skipping sync`);
    return;
  }

  const update = {
    email: primaryEmail,
    firstName: first_name || 'there',
    lastName: last_name || '',
    avatarUrl: image_url || '',
  };

  try {
    await UserModel.findOneAndUpdate(
      { clerkId: id },
      { $set: update, $setOnInsert: { clerkId: id, workspace: `${first_name ?? 'My'}'s Workspace` } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (!isDuplicateKeyError(err)) {
      throw err;
    }
  }
}

export const handleClerkWebhook = asyncHandler(async (req: Request, res: Response) => {
  const event = verifyClerkWebhook(req);

  switch (event.type) {
    case 'user.created':
    case 'user.updated':
      await syncUserUpserted(event.data as ClerkUserWebhookData);
      break;

    case 'user.deleted': {
      const { id } = event.data as { id?: string };
      if (id) {
        await UserModel.deleteOne({ clerkId: id });
      }
      break;
    }

    default:
      logger.debug(`Unhandled Clerk webhook event: ${event.type}`);
  }

  res.status(200).json({ success: true, data: { received: true } });
});
