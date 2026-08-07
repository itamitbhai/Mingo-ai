import { NextFunction, Request, Response } from 'express';
import { MongoServerError } from 'mongodb';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: Record<string, string[]> | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = err.issues.reduce<Record<string, string[]>>((acc, issue) => {
      const key = issue.path.join('.') || 'value';
      acc[key] = [...(acc[key] ?? []), issue.message];
      return acc;
    }, {});
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.fromEntries(
      Object.entries(err.errors).map(([key, value]) => [key, [value.message]])
    );
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for field "${err.path}"`;
  } else if ((err as MongoServerError)?.code === 11000) {
    statusCode = 409;
    const mongoErr = err as MongoServerError;
    const field = Object.keys(mongoErr.keyValue ?? { field: 'value' })[0];
    message = `A record with this ${field} already exists`;
  } else if (err instanceof Error) {
    message = isProd ? message : err.message;
  }

  if (statusCode >= 500) {
    logger.error(message, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(!isProd && err instanceof Error ? { stack: err.stack } : {}),
  });
}
