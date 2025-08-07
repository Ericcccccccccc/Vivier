import { ai } from '../lib/ai';
import { db } from '../lib/database';
import { RateLimitError, ValidationError } from '../types';

export class AIService {
  async generateResponse(
    userId: string,
    prompt: string,
    context?: any,
    stream?: boolean
  ): Promise<any> {
    // Check usage limits
    const usage = await db.getUsage(userId, 'ai_calls', new Date());
    const dailyLimit = 50;
    
    if (usage && usage.count >= dailyLimit) {
      throw new RateLimitError('Daily AI usage limit exceeded');
    }
    
    // Validate prompt
    if (!prompt || prompt.trim().length < 10) {
      throw new ValidationError('Prompt must be at least 10 characters');
    }
    
    if (prompt.length > 4000) {
      throw new ValidationError('Prompt exceeds maximum length of 4000 characters');
    }
    
    const startTime = Date.now();
    
    try {
      let response;
      
      if (stream) {
        // Handle streaming response
        response = await ai.streamGenerate(prompt, {
          maxTokens: 1000,
          temperature: 0.7,
          ...context,
        });
      } else {
        // Regular generation
        response = await ai.generate(prompt, {
          maxTokens: 1000,
          temperature: 0.7,
          ...context,
        });
      }
      
      const responseTime = Date.now() - startTime;
      
      // Update usage
      await db.incrementUsage(userId, 'ai_calls', response.tokensUsed || 100);
      
      // Log the generation for analytics
      await db.logAIGeneration({
        user_id: userId,
        prompt: prompt.substring(0, 500), // Store first 500 chars
        response: response.text?.substring(0, 500),
        model: response.model || 'groq-llama',
        tokens_used: response.tokensUsed || 0,
        response_time_ms: responseTime,
      });
      
      return {
        text: response.text,
        model: response.model,
        tokensUsed: response.tokensUsed,
        responseTime,
        usage: {
          remaining: dailyLimit - (usage?.count || 0) - 1,
          resetAt: this.getResetDate(),
        },
      };
    } catch (error) {
      // Handle rate limiting from AI provider
      if (error instanceof Error && error.message.includes('rate limit')) {
        throw new RateLimitError('AI provider rate limit exceeded. Please try again later.');
      }
      throw error;
    }
  }
  
  async analyzeEmail(
    userId: string,
    emailContent: string
  ): Promise<any> {
    // Check usage limits
    const usage = await db.getUsage(userId, 'ai_calls', new Date());
    const dailyLimit = 50;
    
    if (usage && usage.count >= dailyLimit) {
      throw new RateLimitError('Daily AI usage limit exceeded');
    }
    
    const analysis = await ai.analyzeEmail({
      subject: emailContent,
      body: emailContent,
    });
    
    // Update usage
    await db.incrementUsage(userId, 'ai_calls', 50); // Analysis uses fewer tokens
    
    return {
      ...analysis,
      usage: {
        remaining: dailyLimit - (usage?.count || 0) - 1,
        resetAt: this.getResetDate(),
      },
    };
  }
  
  async getTemplates(userId: string): Promise<any[]> {
    // Get user's custom templates
    const customTemplates = await db.getUserTemplates(userId);
    
    // Get default templates
    const defaultTemplates = await ai.getTemplates();
    
    return [
      ...customTemplates.map(t => ({ ...t, isCustom: true })),
      ...defaultTemplates.map(t => ({ ...t, isCustom: false })),
    ];
  }
  
  async createTemplate(
    userId: string,
    name: string,
    content: string,
    category?: string
  ): Promise<any> {
    // Validate template
    if (!name || name.length < 3) {
      throw new ValidationError('Template name must be at least 3 characters');
    }
    
    if (!content || content.length < 10) {
      throw new ValidationError('Template content must be at least 10 characters');
    }
    
    const template = await db.createUserTemplate({
      user_id: userId,
      name,
      content,
      category: category || 'general',
    });
    
    return template;
  }
  
  async deleteTemplate(userId: string, templateId: string): Promise<void> {
    const template = await db.getUserTemplate(templateId);
    
    if (!template || template.user_id !== userId) {
      throw new ValidationError('Template not found or access denied');
    }
    
    await db.deleteUserTemplate(templateId);
  }
  
  private getResetDate(): Date {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 0);
    return tomorrow;
  }
  
  // Retry logic for AI calls
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on validation errors
        if (error instanceof ValidationError) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

export const aiService = new AIService();