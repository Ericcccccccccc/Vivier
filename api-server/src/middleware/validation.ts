import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../types';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof Error) {
        next(new ValidationError(error.message, error));
      } else {
        next(new ValidationError('Validation failed'));
      }
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof Error) {
        next(new ValidationError(error.message, error));
      } else {
        next(new ValidationError('Query validation failed'));
      }
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof Error) {
        next(new ValidationError(error.message, error));
      } else {
        next(new ValidationError('Params validation failed'));
      }
    }
  };
}