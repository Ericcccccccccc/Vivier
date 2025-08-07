import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config';
import { RateLimitError } from '../types';

class RateLimiter {
  private counts: Map<string, { count: number; resetAt: number }> = new Map();
  
  constructor(
    private windowMs: number,
    private max: number
  ) {}
  
  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const record = this.counts.get(key);
    
    if (!record || record.resetAt < now) {
      // New window
      this.counts.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }
    
    if (record.count >= this.max) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  getRemaining(key: string): number {
    const record = this.counts.get(key);
    if (!record) return this.max;
    return Math.max(0, this.max - record.count);
  }
  
  getResetTime(key: string): number {
    const record = this.counts.get(key);
    if (!record) return Date.now() + this.windowMs;
    return record.resetAt;
  }
}

const limiters = new Map<string, RateLimiter>();

export function createRateLimiter(
  name: string,
  windowMs: number,
  max: number,
  keyGenerator: (req: Request) => string = (req) => req.ip || 'unknown'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${keyGenerator(req)}`;
    
    if (!limiters.has(name)) {
      limiters.set(name, new RateLimiter(windowMs, max));
    }
    
    const limiter = limiters.get(name)!;
    const allowed = await limiter.checkLimit(key);
    
    if (!allowed) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT',
          message: 'Too many requests',
        },
        retryAfter: Math.ceil((limiter.getResetTime(key) - Date.now()) / 1000),
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', limiter.getRemaining(key));
    res.setHeader('X-RateLimit-Reset', new Date(limiter.getResetTime(key)).toISOString());
    
    next();
  };
}

// Different rate limits for different endpoints
export const aiRateLimit = createRateLimiter(
  'ai',
  60 * 1000, // 1 minute
  parseInt(config.AI_RATE_LIMIT_MAX), // 10 AI calls per minute
  (req: any) => req.user?.userId || req.ip || 'unknown'
);

export const authRateLimit = createRateLimiter(
  'auth',
  15 * 60 * 1000, // 15 minutes
  parseInt(config.AUTH_RATE_LIMIT_MAX), // 5 auth attempts per 15 minutes
  (req) => req.ip || 'unknown'
);

// Using express-rate-limit for more robust implementation
export const apiLimiter = rateLimit({
  windowMs: parseInt(config.RATE_LIMIT_WINDOW_MS),
  max: parseInt(config.RATE_LIMIT_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT',
        message: 'Too many requests from this IP',
      },
      timestamp: new Date().toISOString(),
    });
  },
});

export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
});