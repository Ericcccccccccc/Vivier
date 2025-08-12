import { SupabaseAdapter } from '@email-ai/database';
import { FixedSupabaseAdapter } from './database-adapter-fix';
import { config } from '../config';

// Initialize database adapter with extended functionality
export const db = new FixedSupabaseAdapter({
  url: config.SUPABASE_URL,
  anonKey: config.SUPABASE_SERVICE_KEY, // Using service key for backend operations
  serviceKey: config.SUPABASE_SERVICE_KEY,
}) as any;

// Export types from database package
export type { 
  User,
  EmailAccount,
  Email,
  AIResponse,
  UsageMetric,
  DatabaseAdapter
} from '@email-ai/database';