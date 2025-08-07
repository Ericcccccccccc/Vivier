import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required').optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  DATABASE_POOL_MIN: z.string().transform(Number).default('2'),
  DATABASE_POOL_MAX: z.string().transform(Number).default('10'),
  DATABASE_RETRY_ATTEMPTS: z.string().transform(Number).default('3'),
  DATABASE_RETRY_BACKOFF_MS: z.string().transform(Number).default('1000'),
  DATABASE_TIMEOUT_MS: z.string().transform(Number).default('30000'),
});

// Validate environment variables
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.error('Invalid environment configuration', {
      errors: error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    throw new Error('Invalid environment configuration. Check your .env file.');
  }
  throw error;
}

// Database configuration
export const dbConfig = {
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  },
  pooling: {
    min: env.DATABASE_POOL_MIN,
    max: env.DATABASE_POOL_MAX,
  },
  retry: {
    maxAttempts: env.DATABASE_RETRY_ATTEMPTS,
    backoffMs: env.DATABASE_RETRY_BACKOFF_MS,
  },
  timeout: env.DATABASE_TIMEOUT_MS,
  environment: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
};

// Usage limits for free tier
export const FREE_TIER_LIMITS = {
  ai_calls: 100, // per month
  emails_processed: 1000, // per month
  storage_used: 100 * 1024 * 1024, // 100MB in bytes
  templates_created: 10, // total
};

// Usage limits for pro tier
export const PRO_TIER_LIMITS = {
  ai_calls: 1000, // per month
  emails_processed: 10000, // per month
  storage_used: 1024 * 1024 * 1024, // 1GB in bytes
  templates_created: 100, // total
};

// Usage limits for enterprise tier
export const ENTERPRISE_TIER_LIMITS = {
  ai_calls: -1, // unlimited
  emails_processed: -1, // unlimited
  storage_used: -1, // unlimited
  templates_created: -1, // unlimited
};

// Get usage limits based on subscription tier
export function getUsageLimits(tier: 'free' | 'pro' | 'enterprise') {
  switch (tier) {
    case 'free':
      return FREE_TIER_LIMITS;
    case 'pro':
      return PRO_TIER_LIMITS;
    case 'enterprise':
      return ENTERPRISE_TIER_LIMITS;
    default:
      return FREE_TIER_LIMITS;
  }
}

// Rate limiting configuration
export const rateLimits = {
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: {
      free: 60,
      pro: 300,
      enterprise: -1, // unlimited
    },
  },
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxEmails: {
      free: 10,
      pro: 100,
      enterprise: -1, // unlimited
    },
  },
};

// Encryption configuration
export const encryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000,
  saltLength: 32,
  tagLength: 16,
  ivLength: 16,
};

// Cache configuration
export const cacheConfig = {
  ttl: {
    user: 5 * 60, // 5 minutes
    emailAccount: 10 * 60, // 10 minutes
    template: 30 * 60, // 30 minutes
    usage: 60, // 1 minute
  },
  maxSize: 1000, // maximum number of cached items
};

// Export configuration validation function
export function validateConfig(): boolean {
  try {
    // Check Supabase configuration
    if (!dbConfig.supabase.url || !dbConfig.supabase.anonKey) {
      logger.error('Missing required Supabase configuration');
      return false;
    }

    // Warn if service key is missing in production
    if (dbConfig.environment === 'production' && !dbConfig.supabase.serviceKey) {
      logger.warn('Service key not configured for production environment');
    }

    // Validate pool configuration
    if (dbConfig.pooling.min > dbConfig.pooling.max) {
      logger.error('Invalid pool configuration: min > max');
      return false;
    }

    logger.info('Configuration validated successfully', {
      environment: dbConfig.environment,
      supabaseUrl: dbConfig.supabase.url,
      pooling: dbConfig.pooling,
      retry: dbConfig.retry,
    });

    return true;
  } catch (error) {
    logger.error('Configuration validation failed', { error });
    return false;
  }
}

// Export environment type for TypeScript
export type Environment = typeof env;