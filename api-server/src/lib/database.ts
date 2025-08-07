import { SupabaseAdapter } from '@email-ai/database';
import { config } from '../config';

// Initialize database adapter
export const db = new SupabaseAdapter({
  url: config.SUPABASE_URL,
  serviceKey: config.SUPABASE_SERVICE_KEY,
});

// Export types from database package
export type { 
  User,
  EmailAccount,
  Email,
  AIResponse,
  UsageMetric,
  DatabaseAdapter
} from '@email-ai/database';