import { GroqProvider, OpenAIProvider, AIProvider } from '@email-ai/ai-provider';
import { config } from '../config';

// Initialize AI provider based on configuration
let aiProvider: AIProvider;

if (config.AI_PROVIDER === 'groq') {
  aiProvider = new GroqProvider({
    apiKey: config.GROQ_API_KEY,
  });
} else {
  // Fallback to OpenAI if configured
  aiProvider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY || '',
  });
}

export const ai = aiProvider;

// Export types from AI provider package
export type {
  AIProvider,
  EmailContext,
  EmailResponse,
  GenerateOptions,
  StreamOptions,
  AnalysisResult,
  ResponseTemplate
} from '@email-ai/ai-provider';