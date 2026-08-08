import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';
import { env, isDev } from './config/env';
import { apiRateLimiter, errorHandler, notFoundHandler } from './middlewares';
import routes from './routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(
  compression({
    // The AI message endpoint streams Server-Sent Events; gzip would buffer
    // chunks and defeat progressive delivery, so it's excluded here.
    filter: (req, res) => {
      if (req.method === 'POST' && req.originalUrl.includes('/messages')) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

if (isDev) {
  app.use(morgan('dev'));
}

app.use(clerkMiddleware());

// Mounted ahead of the global JSON parser: Svix signature verification needs
// the untouched raw request body, not the parsed object.
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRateLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
