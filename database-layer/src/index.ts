/**
 * Database Layer - Main Export File
 * 
 * This module provides a database abstraction layer with Supabase as the primary implementation.
 * The architecture allows for easy swapping between different database providers.
 */

// Export main adapter and types
export { DatabaseAdapter } from './interface';
export { SupabaseAdapter, SupabaseConfig } from './adapters/supabase';

// Export all types
export * from './types';

// Export error classes
export {
  DatabaseError,
  DatabaseConnectionError,
  DatabaseOperationError,
  ValidationError,
  TransactionError,
  NotFoundError,
  DuplicateError,
  RateLimitError,
  UsageLimitError,
  AuthenticationError,
  AuthorizationError,
  TimeoutError,
  isRetryableError,
  getRetryDelay,
  withErrorHandling,
} from './errors';

// Export configuration
export {
  dbConfig,
  FREE_TIER_LIMITS,
  PRO_TIER_LIMITS,
  ENTERPRISE_TIER_LIMITS,
  getUsageLimits,
  rateLimits,
  encryptionConfig,
  cacheConfig,
  validateConfig,
  Environment,
} from './config';

// Export migration utilities
export { MigrationRunner, Migration, runMigrations, rollbackMigrations } from './migrations/runner';

// Export logger
export { logger } from './utils/logger';

// Factory function to create database adapter
export function createDatabaseAdapter(type: 'supabase' = 'supabase', config?: any): DatabaseAdapter {
  switch (type) {
    case 'supabase':
      if (!config) {
        config = {
          url: process.env.SUPABASE_URL,
          anonKey: process.env.SUPABASE_ANON_KEY,
          serviceKey: process.env.SUPABASE_SERVICE_KEY,
        };
      }
      return new SupabaseAdapter(config);
    default:
      throw new Error(`Unsupported database adapter type: ${type}`);
  }
}

// Re-export as default
export default {
  createDatabaseAdapter,
  SupabaseAdapter,
};