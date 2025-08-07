// Main exports for the AI Provider Layer
export * from './interface';
export * from './errors';
export * from './cache';
export * from './rate-limiter';
export * from './usage-tracker';
export * from './providers/groq';
export * from './prompts/email-response';
export * from './prompts/email-analysis';
export * from './templates/email-templates';

// Re-export main provider for convenience
export { GroqProvider as DefaultProvider } from './providers/groq';

// Factory function for creating providers
import { GroqProvider, GroqConfig } from './providers/groq';
import { AIProvider } from './interface';

export enum ProviderType {
  GROQ = 'groq',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  LOCAL = 'local',
}

export interface ProviderFactoryConfig {
  type: ProviderType;
  apiKey: string;
  config?: any;
}

export class AIProviderFactory {
  static create(config: ProviderFactoryConfig): AIProvider {
    switch (config.type) {
      case ProviderType.GROQ:
        return new GroqProvider({
          apiKey: config.apiKey,
          ...config.config,
        } as GroqConfig);
      
      case ProviderType.OPENAI:
        // Placeholder for OpenAI provider
        throw new Error('OpenAI provider not yet implemented');
      
      case ProviderType.ANTHROPIC:
        // Placeholder for Anthropic provider
        throw new Error('Anthropic provider not yet implemented');
      
      case ProviderType.LOCAL:
        // Placeholder for local model provider
        throw new Error('Local model provider not yet implemented');
      
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }
  
  static async createWithHealthCheck(
    config: ProviderFactoryConfig
  ): Promise<AIProvider> {
    const provider = this.create(config);
    
    // Verify the provider is available
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new Error(`Provider ${config.type} is not available`);
    }
    
    return provider;
  }
}

// Convenience function for quick setup
export async function createEmailAIProvider(
  apiKey?: string,
  options?: Partial<GroqConfig>
): Promise<AIProvider> {
  const key = apiKey || process.env.GROQ_API_KEY;
  
  if (!key) {
    throw new Error('API key is required. Provide it as a parameter or set GROQ_API_KEY environment variable.');
  }
  
  return AIProviderFactory.createWithHealthCheck({
    type: ProviderType.GROQ,
    apiKey: key,
    config: {
      cacheConfig: {
        ttl: 3600,
        maxSize: 100,
        enabled: true,
      },
      rateLimits: {
        requestsPerMinute: 30,
        tokensPerMinute: 6000,
        requestsPerDay: 1000,
        tokensPerDay: 200000,
      },
      useAdaptiveRateLimiting: true,
      ...options,
    },
  });
}

// Example usage
export const example = `
import { createEmailAIProvider } from '@vivier/ai-provider-layer';

async function main() {
  // Create provider with automatic configuration
  const provider = await createEmailAIProvider();
  
  // Generate an email response
  const response = await provider.generateEmailResponse({
    subject: 'Meeting Request',
    from: 'colleague@company.com',
    to: ['me@company.com'],
    body: 'Can we schedule a meeting for tomorrow?',
    responseStyle: 'formal',
  });
  
  console.log(response.text);
  
  // Stream a response
  const stream = provider.generateStreamingResponse({
    messages: [
      { role: 'user', content: 'Write a brief thank you note' }
    ],
  });
  
  for await (const chunk of stream) {
    process.stdout.write(chunk);
  }
}

main().catch(console.error);
`;