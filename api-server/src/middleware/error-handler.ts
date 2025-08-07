import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error
  if (req.log) {
    req.log.error({
      err,
      req: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
      },
    });
  } else {
    console.error('Error:', err);
  }
  
  // Determine status code and message
  let status = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any = undefined;
  
  if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    code = err.code;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
    details = err.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  } else if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }
  
  // Send response
  res.status(status).json({
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  });
}