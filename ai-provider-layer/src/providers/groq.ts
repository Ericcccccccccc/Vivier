import Groq from 'groq-sdk';
import {
  AIProvider,
  AIGenerationInput,
  AIResponse,
  EmailContext,
  EmailResponse,
  Email,
  SentimentAnalysis,
  RateLimitStatus,
  UsageStats,
  ModelInfo,
  ProviderConfig,
  CacheConfig,
  RateLimits,
} from '../interface';
import {
  AIProviderError,
  RateLimitError,
  TokenLimitError,
  NetworkError,
  isRateLimitError,
  ErrorHandler,
} from '../errors';
import { ResponseCache, TieredCache } from '../cache';
import { RateLimiter, AdaptiveRateLimiter } from '../rate-limiter';
import { UsageTracker } from '../usage-tracker';
import { EmailPromptBuilder, PromptOptimizer } from '../prompts/email-response';
import { EmailAnalysisPromptBuilder } from '../prompts/email-analysis';

export interface GroqConfig extends ProviderConfig {
  model?: string;
  temperature?: number;
  maxRetries?: number;
  cacheConfig?: CacheConfig;
  rateLimits?: RateLimits;
  useAdaptiveRateLimiting?: boolean;
}

export class GroqProvider implements AIProvider {
  private client: Groq;
  private cache: ResponseCache;
  private rateLimiter: RateLimiter;
  private usageTracker: UsageTracker;
  private promptBuilder: EmailPromptBuilder;
  private analysisPromptBuilder: EmailAnalysisPromptBuilder;
  private model: string;
  private temperature: number;
  private maxRetries: number;

  constructor(private config: GroqConfig) {
    this.client = new Groq({
      apiKey: config.apiKey,
    });

    this.model = config.model || 'openai/gpt-oss-120b';
    this.temperature = config.temperature ?? 0.7;
    this.maxRetries = config.maxRetries ?? 3;

    // Initialize cache (use tiered cache for better performance)
    const cacheConfig = config.cacheConfig || {
      ttl: 3600,
      maxSize: 100,
      enabled: true,
    };
    this.cache = new TieredCache(cacheConfig);

    // Initialize rate limiter (use adaptive if specified)
    const rateLimits = config.rateLimits || {
      requestsPerMinute: 30,
      tokensPerMinute: 6000,
      requestsPerDay: 1000,
      tokensPerDay: 200000,
    };
    
    this.rateLimiter = config.useAdaptiveRateLimiting
      ? new AdaptiveRateLimiter(rateLimits)
      : new RateLimiter(rateLimits);

    this.usageTracker = new UsageTracker();
    this.promptBuilder = new EmailPromptBuilder();
    this.analysisPromptBuilder = new EmailAnalysisPromptBuilder();
  }

  async generateResponse(input: AIGenerationInput): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      await this.rateLimiter.checkLimit();
      
      const completion = await this.client.chat.completions.create({
        messages: input.messages,
        model: this.model,
        temperature: input.options?.temperature ?? this.temperature,
        max_tokens: input.options?.maxTokens ?? 8192,
        top_p: input.options?.topP ?? 1,
        stream: false,
        stop: input.options?.stopSequences ?? null,
      });

      const response = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;
      
      this.rateLimiter.recordUsage(tokensUsed);
      
      const result: AIResponse = {
        text: response,
        model: this.model,
        tokensUsed,
        responseTimeMs: Date.now() - startTime,
        confidence: this.calculateConfidence(response),
        metadata: {
          provider: 'groq',
          finishReason: completion.choices[0]?.finish_reason,
        },
      };

      this.usageTracker.record({
        provider: 'groq',
        model: this.model,
        tokensUsed,
        responseTimeMs: result.responseTimeMs,
        success: true,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.handleError(error, startTime);
      throw error;
    }
  }

  async *generateStreamingResponse(input: AIGenerationInput): AsyncGenerator<string> {
    try {
      await this.rateLimiter.checkLimit();
      
      const completion = await this.client.chat.completions.create({
        messages: input.messages,
        model: this.model,
        temperature: input.options?.temperature ?? this.temperature,
        max_tokens: input.options?.maxTokens ?? 8192,
        top_p: input.options?.topP ?? 1,
        stream: true,
        stop: input.options?.stopSequences ?? null,
      });

      let tokensGenerated = 0;
      
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          tokensGenerated += Math.ceil(content.length / 4);
          yield content;
        }
      }
      
      this.rateLimiter.recordUsage(tokensGenerated);
      
      this.usageTracker.record({
        provider: 'groq',
        model: this.model,
        tokensUsed: tokensGenerated,
        responseTimeMs: 0,
        success: true,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error, Date.now());
      throw error;
    }
  }

  async generateEmailResponse(context: EmailContext): Promise<EmailResponse> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.cache.getCacheKey(context);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.usageTracker.record({
        provider: 'groq',
        model: 'cache',
        tokensUsed: 0,
        responseTimeMs: Date.now() - startTime,
        success: true,
        timestamp: new Date(),
      });
      return cached as EmailResponse;
    }

    // Check rate limits
    await this.rateLimiter.checkLimit();

    const systemPrompt = this.promptBuilder.buildSystemPrompt(context.responseStyle || 'formal');
    const userPrompt = this.promptBuilder.buildEmailPrompt(context);
    
    // Optimize prompts to save tokens
    const optimizedSystemPrompt = PromptOptimizer.optimize(systemPrompt);
    const optimizedUserPrompt = PromptOptimizer.optimize(userPrompt);

    try {
      const completion = await ErrorHandler.withRetry(
        async () => {
          return await this.client.chat.completions.create({
            messages: [
              { role: 'system', content: optimizedSystemPrompt },
              { role: 'user', content: optimizedUserPrompt },
            ],
            model: this.model,
            temperature: this.temperature,
            max_tokens: context.maxLength ? Math.min(context.maxLength * 2, 8192) : 8192,
            stream: true,
                stop: null,
          });
        },
        this.maxRetries
      );

      let fullResponse = '';
      let tokenCount = 0;

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        
        // Estimate tokens
        tokenCount += Math.ceil(content.length / 4);
        
        // Check length limit
        if (context.maxLength && fullResponse.split(' ').length > context.maxLength) {
          break;
        }
      }

      const responseTime = Date.now() - startTime;
      
      // Analyze the generated response for intent and actions
      const intent = this.extractIntent(fullResponse);
      const suggestedActions = this.extractActions(fullResponse);

      const response: EmailResponse = {
        text: fullResponse.trim(),
        model: this.model,
        tokensUsed: tokenCount,
        responseTimeMs: responseTime,
        confidence: this.calculateConfidence(fullResponse),
        metadata: {
          style: context.responseStyle,
          truncated: context.maxLength ? fullResponse.split(' ').length > context.maxLength : false,
          provider: 'groq',
        },
        suggestedActions,
        detectedIntent: intent,
        requiresFollowUp: this.detectFollowUpNeeded(fullResponse),
      };

      // Cache the response
      await this.cache.set(cacheKey, response);
      
      // Record metrics
      this.rateLimiter.recordUsage(tokenCount);
      this.usageTracker.record({
        provider: 'groq',
        model: this.model,
        tokensUsed: tokenCount,
        responseTimeMs: responseTime,
        success: true,
        timestamp: new Date(),
      });

      if (this.config.useAdaptiveRateLimiting) {
        (this.rateLimiter as AdaptiveRateLimiter).recordSuccess();
      }

      return response;
    } catch (error) {
      this.handleError(error, startTime);
      
      // Return a fallback response if critical
      if (this.shouldUseFallback(error)) {
        return this.generateFallbackResponse(context);
      }
      
      throw error;
    }
  }

  async analyzeEmailSentiment(email: string): Promise<SentimentAnalysis> {
    const prompt = this.analysisPromptBuilder.buildSentimentAnalysisPrompt(email);
    
    const response = await this.generateResponse({
      messages: [
        { role: 'system', content: 'You are an email sentiment analyzer.' },
        { role: 'user', content: prompt },
      ],
    });

    return this.analysisPromptBuilder.parseSentimentResponse(response.text);
  }

  async summarizeEmailThread(thread: Email[]): Promise<string> {
    const prompt = this.promptBuilder.buildSummaryPrompt(thread);
    
    const response = await this.generateResponse({
      messages: [
        { role: 'system', content: 'You are an email thread summarizer.' },
        { role: 'user', content: prompt },
      ],
      options: {
        temperature: 0.5, // Lower temperature for more consistent summaries
        maxTokens: 500,
      },
    });

    return response.text;
  }

  getTokenCount(text: string): number {
    return PromptOptimizer.estimateTokenCount(text);
  }

  async checkRateLimit(): Promise<RateLimitStatus> {
    return this.rateLimiter.getStatus();
  }

  async getUsageStats(): Promise<UsageStats> {
    return this.usageTracker.getUsageStats();
  }

  getModelInfo(): ModelInfo {
    return {
      name: this.model,
      provider: 'Groq',
      version: '1.0',
      contextWindow: 120000, // Approximate for GPT-OSS-120B
      maxOutputTokens: 8192,
      costPer1kTokens: {
        input: 0.015,
        output: 0.06,
      },
      capabilities: [
        'chat',
        'streaming',
        'email_generation',
        'sentiment_analysis',
        'summarization',
      ],
      recommendedUseCase: 'High-quality email responses with streaming support',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check
      const response = await this.client.chat.completions.create({
        messages: [{ role: 'user', content: 'test' }],
        model: this.model,
        max_tokens: 1,
        stream: false,
      });
      
      return !!response.choices[0]?.message;
    } catch (error) {
      return false;
    }
  }

  private calculateConfidence(response: string): number {
    let confidence = 0.5;
    
    // Check for complete sentences
    if (response.match(/[.!?]$/)) confidence += 0.1;
    
    // Check for reasonable length
    const wordCount = response.split(' ').length;
    if (wordCount > 20 && wordCount < 500) confidence += 0.2;
    
    // Check for professional language indicators
    if (response.match(/\b(please|thank you|regards|sincerely)\b/i)) confidence += 0.1;
    
    // Check for action items or clear responses
    if (response.match(/\b(will|would|can|could|should)\b/i)) confidence += 0.1;
    
    // Check for greeting and closing
    if (response.match(/^(dear|hi|hello|good)/i)) confidence += 0.05;
    if (response.match(/(regards|sincerely|best|thanks)[\s,]/i)) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }

  private extractIntent(response: string): any {
    // Simple intent detection based on response content
    const intents = {
      meeting_request: /\b(schedule|meeting|calendar|available|time)\b/i,
      information_request: /\b(provide|send|share|need|require)\b/i,
      task_assignment: /\b(assigned|complete|finish|deadline|due)\b/i,
      thank_you: /\b(thank|appreciate|grateful|gratitude)\b/i,
      follow_up: /\b(follow.?up|checking|reminder|status)\b/i,
    };

    for (const [type, pattern] of Object.entries(intents)) {
      if (pattern.test(response)) {
        return {
          type,
          confidence: 0.7,
        };
      }
    }

    return {
      type: 'other',
      confidence: 0.5,
    };
  }

  private extractActions(response: string): string[] {
    const actions: string[] = [];
    
    // Look for action patterns
    const actionPatterns = [
      /I will (\w+.*?)(?:\.|,|and)/gi,
      /I'll (\w+.*?)(?:\.|,|and)/gi,
      /I am going to (\w+.*?)(?:\.|,|and)/gi,
      /Please (\w+.*?)(?:\.|,|and)/gi,
      /Could you (\w+.*?)(?:\.|,|and)/gi,
    ];

    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        actions.push(match[1].trim());
      }
    });

    return actions.slice(0, 5); // Limit to 5 actions
  }

  private detectFollowUpNeeded(response: string): boolean {
    const followUpIndicators = [
      /\b(follow.?up|get back|reach out|contact|update you)\b/i,
      /\b(will send|will provide|will share)\b/i,
      /\b(let me know|please confirm|please advise)\b/i,
      /\b(next steps?|action items?)\b/i,
    ];

    return followUpIndicators.some(pattern => pattern.test(response));
  }

  private handleError(error: any, startTime: number): void {
    const responseTime = Date.now() - startTime;
    
    this.usageTracker.record({
      provider: 'groq',
      model: this.model,
      tokensUsed: 0,
      responseTimeMs: responseTime,
      success: false,
      error: error.message,
      timestamp: new Date(),
    });

    if (this.config.useAdaptiveRateLimiting) {
      (this.rateLimiter as AdaptiveRateLimiter).recordError();
    }

    // Transform Groq errors to our error types
    if (this.isGroqRateLimitError(error)) {
      throw new RateLimitError(
        'Groq rate limit exceeded',
        this.getRetryAfter(error)
      );
    }

    if (this.isGroqTokenError(error)) {
      throw new TokenLimitError(
        'Token limit exceeded',
        0,
        8192
      );
    }

    if (error.response?.status >= 500) {
      throw new NetworkError(
        'Groq service error',
        error.response.status,
        error.response.data
      );
    }

    throw new AIProviderError('Groq provider error', error);
  }

  private isGroqRateLimitError(error: any): boolean {
    return error.response?.status === 429 || 
           error.message?.includes('rate limit');
  }

  private isGroqTokenError(error: any): boolean {
    return error.message?.includes('token') || 
           error.message?.includes('context length');
  }

  private getRetryAfter(error: any): number {
    const retryAfter = error.response?.headers?.['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter) * 1000; // Convert to milliseconds
    }
    return 60000; // Default to 1 minute
  }

  private shouldUseFallback(error: any): boolean {
    return isRateLimitError(error) || 
           error instanceof NetworkError;
  }

  private generateFallbackResponse(context: EmailContext): EmailResponse {
    const fallbackText = `Thank you for your email regarding "${context.subject}". 
I've received your message and will review it carefully. 
I'll get back to you as soon as possible with a detailed response.

Best regards`;

    return {
      text: fallbackText,
      model: 'fallback',
      tokensUsed: 0,
      responseTimeMs: 0,
      confidence: 0.3,
      metadata: {
        fallback: true,
        reason: 'Service temporarily unavailable',
      },
    };
  }
}