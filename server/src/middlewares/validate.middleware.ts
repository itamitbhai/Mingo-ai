import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodType } from 'zod';
import { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError';

type Target = 'body' | 'query' | 'params';

export function validate(schema: ZodType, target: Target = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = result.error.issues.reduce<Record<string, string[]>>((acc, issue) => {
        const key = issue.path.join('.') || target;
        acc[key] = [...(acc[key] ?? []), issue.message];
        return acc;
      }, {});

      return next(ApiError.badRequest('Validation failed', errors));
    }

    // Assign the parsed & coerced value back so controllers get clean data.
    (req as Record<Target, unknown>)[target] = result.data;
    next();
  };
}

export function validateObjectId(paramName = 'id'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.params[paramName];

    if (!Types.ObjectId.isValid(value)) {
      return next(ApiError.badRequest(`Invalid ${paramName}`));
    }

    next();
  };
}
