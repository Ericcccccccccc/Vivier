import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, UnauthorizedError } from '../types';

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }
    
    const payload = jwt.verify(token, config.JWT_SECRET) as {
      userId: string;
      email: string;
    };
    
    req.user = {
      userId: payload.userId,
      email: payload.email,
    };
    
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
}

export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      // No token is OK for optional auth
      return next();
    }
    
    const payload = jwt.verify(token, config.JWT_SECRET) as {
      userId: string;
      email: string;
    };
    
    req.user = {
      userId: payload.userId,
      email: payload.email,
    };
    
    next();
  } catch (error) {
    // Invalid token is OK for optional auth, just continue without user
    next();
  }
}