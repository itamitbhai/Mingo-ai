import mongoose, { ClientSession } from 'mongoose';
import { logger } from './logger';

let warnedNoTransactions = false;

function isTransactionUnsupportedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : '';
  return (
    message.includes('Transaction numbers are only allowed on a replica set') ||
    message.includes('This MongoDB deployment does not support retryable writes') ||
    message.includes('IllegalOperation')
  );
}

/**
 * Runs `fn` inside a MongoDB session transaction when the connected server supports it (Atlas,
 * or any replica set). A standalone dev MongoDB instance rejects transactions outright — in that
 * case this falls back to invoking `fn` without a session so every workspace service still works
 * locally; the operation just won't be atomic until the environment gains a replica set (spec §9,
 * §35: "if MongoDB transactions are unavailable... design so transactional behavior can be added
 * cleanly").
 */
export async function withTransaction<T>(
  fn: (session: ClientSession | undefined) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } catch (err) {
    if (isTransactionUnsupportedError(err)) {
      if (!warnedNoTransactions) {
        warnedNoTransactions = true;
        logger.warn(
          'workspace.transactions.unsupported — MongoDB transactions are unavailable on this server (not a replica set); falling back to non-atomic execution.'
        );
      }
      return fn(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
