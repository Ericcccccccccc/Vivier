import { GroqProvider, AIProvider, AIProviderFactory, ProviderType } from '@email-ai/ai-provider';
import { config } from '../config';

// Initialize AI provider based on configuration
let aiProvider: AIProvider;

if (config.AI_PROVIDER === 'groq') {
  aiProvider = new GroqProvider({
    apiKey: config.GROQ_API_KEY,
  });
} else {
  // Fallback to Groq if no other provider available
  aiProvider = new GroqProvider({
    apiKey: config.GROQ_API_KEY,
  });
}

// Create a wrapper with convenience methods
class AIWrapper {
  constructor(private aiProvider: AIProvider) {}
  
  async generate(prompt: string, options?: any): Promise<any> {
    const response = await this.aiProvider.generateResponse({
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: prompt }
      ],
      options
    });
    return response;
  }
  
  async streamGenerate(prompt: string, options?: any): Promise<any> {
    const generator = this.aiProvider.generateStreamingResponse({
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: prompt }
      ],
      options
    });
    
    let fullText = '';
    for await (const chunk of generator) {
      fullText += chunk;
    }
    
    return {
      text: fullText,
      model: this.aiProvider.getModelInfo().name,
      tokensUsed: Math.ceil(fullText.length / 4)
    };
  }
  
  async analyzeEmail(email: { subject: string; body: string }): Promise<any> {
    return this.aiProvider.analyzeEmailSentiment(email.body);
  }
  
  async generateEmailResponse(context: any): Promise<any> {
    return this.aiProvider.generateEmailResponse(context);
  }
  
  async getTemplates(): Promise<any[]> {
    // Return default templates
    return [
      {
        id: 'thank-you',
        name: 'Thank You',
        content: 'Thank you for your message. I appreciate your time and will respond shortly.',
        category: 'general'
      },
      {
        id: 'meeting-request',
        name: 'Meeting Request',
        content: 'I would like to schedule a meeting to discuss {{topic}}. Are you available {{timeframe}}?',
        category: 'meeting'
      },
      {
        id: 'follow-up',
        name: 'Follow Up',
        content: 'I wanted to follow up on {{topic}}. Please let me know if you need any additional information.',
        category: 'general'
      }
    ];
  }
  
  // Expose the underlying provider for direct access
  get provider(): AIProvider {
    return this.aiProvider;
  }
}

export const ai = new AIWrapper(aiProvider);

// Export types from AI provider package
export type {
  AIProvider,
  AIGenerationInput,
  AIResponse,
  EmailGenerationContext,
  EmailAnalysisInput,
  StreamingResponse
} from '@email-ai/ai-provider';