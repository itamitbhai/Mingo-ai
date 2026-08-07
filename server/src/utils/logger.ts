type LogMeta = unknown;

const timestamp = () => new Date().toISOString();

export const logger = {
  info: (message: string, meta?: LogMeta) => {
    console.log(`[${timestamp()}] INFO  ${message}`, meta ?? '');
  },
  warn: (message: string, meta?: LogMeta) => {
    console.warn(`[${timestamp()}] WARN  ${message}`, meta ?? '');
  },
  error: (message: string, meta?: LogMeta) => {
    console.error(`[${timestamp()}] ERROR ${message}`, meta ?? '');
  },
  debug: (message: string, meta?: LogMeta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${timestamp()}] DEBUG ${message}`, meta ?? '');
    }
  },
};
