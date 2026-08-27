import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { getDockerClient } from './sandbox/sandbox.manager';
import { startOrphanSweep } from './sandbox/sandbox.cleanup';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    await connectDB();

    const server = app.listen(env.PORT, () => {
      logger.info(`Mingo AI API listening on port ${env.PORT} [${env.NODE_ENV}]`);
    });

    // Best-effort — never blocks/crashes startup if Docker isn't installed or reachable (spec §66/§67);
    // sandbox-creating requests still surface a clear "unavailable" error on their own.
    startOrphanSweep(getDockerClient());

    const shutdown = (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection', reason);
    });
  } catch (err) {
    logger.error('Failed to start the server', err);
    process.exit(1);
  }
}

bootstrap();
