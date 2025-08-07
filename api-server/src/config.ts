import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8080'),
  
  // Database
  DATABASE_PROVIDER: z.enum(['supabase', 'postgres']).default('supabase'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string(),
  
  // AI
  AI_PROVIDER: z.enum(['groq', 'openai']).default('groq'),
  GROQ_API_KEY: z.string(),
  
  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  
  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX: z.string().default('100'),
  AI_RATE_LIMIT_MAX: z.string().default('10'),
  AUTH_RATE_LIMIT_MAX: z.string().default('5'),
  
  // Google Cloud
  GCP_PROJECT_ID: z.string().optional(),
  GCP_REGION: z.string().default('us-central1'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof envSchema>;

let config: Config;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Invalid environment configuration:');
    error.errors.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { config };