export interface AIProvider {
  generateResponse(input: AIGenerationInput): Promise<AIResponse>;
  generateStreamingResponse(input: AIGenerationInput): AsyncGenerator<string>;
  
  analyzeEmailSentiment(email: string): Promise<SentimentAnalysis>;
  generateEmailResponse(email: EmailContext): Promise<EmailResponse>;
  summarizeEmailThread(thread: Email[]): Promise<string>;
  
  getTokenCount(text: string): number;
  checkRateLimit(): Promise<RateLimitStatus>;
  getUsageStats(): Promise<UsageStats>;
  
  getModelInfo(): ModelInfo;
  isAvailable(): Promise<boolean>;
}

export interface AIGenerationInput {
  messages: Message[];
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stopSequences?: string[];
  };
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EmailContext {
  subject: string;
  from: string;
  to: string[];
  body: string;
  thread?: Email[];
  responseStyle?: 'formal' | 'casual' | 'brief';
  maxLength?: number;
  includeSignature?: boolean;
}

export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  timestamp: Date;
  attachments?: Attachment[];
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
}

export interface AIResponse {
  text: string;
  model: string;
  tokensUsed: number;
  responseTimeMs: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface EmailResponse extends AIResponse {
  suggestedActions?: string[];
  detectedIntent?: EmailIntent;
  requiresFollowUp?: boolean;
}

export interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  score: number;
  emotions?: {
    joy?: number;
    anger?: number;
    sadness?: number;
    fear?: number;
    surprise?: number;
  };
  urgency: 'low' | 'medium' | 'high';
  professionalism: number;
}

export interface EmailIntent {
  type: 'meeting_request' | 'information_request' | 'task_assignment' | 
        'feedback' | 'complaint' | 'thank_you' | 'introduction' | 
        'follow_up' | 'announcement' | 'other';
  confidence: number;
  requiredActions?: string[];
}

export interface RateLimitStatus {
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: Date;
  isLimited: boolean;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  byModel: Record<string, ModelUsage>;
  byDay: Record<string, DailyUsage>;
}

export interface ModelUsage {
  requests: number;
  tokens: number;
  cost: number;
  averageLatency: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  errors: number;
}

export interface ModelInfo {
  name: string;
  provider: string;
  version: string;
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  capabilities: string[];
  recommendedUseCase: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  enabled: boolean;
}

export interface RateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

export type ResponseStyle = 'formal' | 'casual' | 'brief';