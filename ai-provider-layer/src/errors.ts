export class AIProviderError extends Error {
  public readonly cause?: any;
  public readonly timestamp: Date;

  constructor(message: string, cause?: any) {
    super(message);
    this.name = 'AIProviderError';
    this.cause = cause;
    this.timestamp = new Date();
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      cause: this.cause,
      stack: this.stack,
    };
  }
}

export class RateLimitError extends AIProviderError {
  public readonly retryAfter: number;
  public readonly limitType: 'requests' | 'tokens';

  constructor(
    message: string, 
    retryAfter: number,
    limitType: 'requests' | 'tokens' = 'requests'
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.limitType = limitType;
  }

  getRetryDate(): Date {
    return new Date(Date.now() + this.retryAfter);
  }
}

export class TokenLimitError extends AIProviderError {
  public readonly tokensUsed: number;
  public readonly limit: number;
  public readonly tokensRequired: number;

  constructor(
    message: string,
    tokensUsed: number,
    limit: number,
    tokensRequired?: number
  ) {
    super(message);
    this.name = 'TokenLimitError';
    this.tokensUsed = tokensUsed;
    this.limit = limit;
    this.tokensRequired = tokensRequired || tokensUsed;
  }

  getTokensRemaining(): number {
    return Math.max(0, this.limit - this.tokensUsed);
  }
}

export class ModelUnavailableError extends AIProviderError {
  public readonly model: string;
  public readonly alternativeModels?: string[];

  constructor(
    message: string,
    model: string,
    alternativeModels?: string[]
  ) {
    super(message);
    this.name = 'ModelUnavailableError';
    this.model = model;
    this.alternativeModels = alternativeModels;
  }
}

export class InvalidPromptError extends AIProviderError {
  public readonly prompt: string;
  public readonly reason: string;
  public readonly suggestions?: string[];

  constructor(
    message: string,
    prompt: string,
    reason: string,
    suggestions?: string[]
  ) {
    super(message);
    this.name = 'InvalidPromptError';
    this.prompt = prompt;
    this.reason = reason;
    this.suggestions = suggestions;
  }
}

export class NetworkError extends AIProviderError {
  public readonly statusCode?: number;
  public readonly responseBody?: string;

  constructor(
    message: string,
    statusCode?: number,
    responseBody?: string,
    cause?: any
  ) {
    super(message, cause);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }

  isRetryable(): boolean {
    if (!this.statusCode) return true;
    return this.statusCode >= 500 || this.statusCode === 429;
  }
}

export class CacheError extends AIProviderError {
  public readonly operation: 'read' | 'write' | 'delete' | 'clear';

  constructor(
    message: string,
    operation: 'read' | 'write' | 'delete' | 'clear',
    cause?: any
  ) {
    super(message, cause);
    this.name = 'CacheError';
    this.operation = operation;
  }
}

export class ValidationError extends AIProviderError {
  public readonly field: string;
  public readonly value: any;
  public readonly constraints: Record<string, any>;

  constructor(
    message: string,
    field: string,
    value: any,
    constraints: Record<string, any>
  ) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.constraints = constraints;
  }
}

export function isRateLimitError(error: any): error is RateLimitError {
  return error instanceof RateLimitError || error?.name === 'RateLimitError';
}

export function isTokenLimitError(error: any): error is TokenLimitError {
  return error instanceof TokenLimitError || error?.name === 'TokenLimitError';
}

export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError || error?.name === 'NetworkError';
}

export function isRetryableError(error: any): boolean {
  if (error instanceof NetworkError) {
    return error.isRetryable();
  }
  if (error instanceof RateLimitError) {
    return true;
  }
  if (error instanceof ModelUnavailableError) {
    return error.alternativeModels && error.alternativeModels.length > 0;
  }
  return false;
}

export class ErrorHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!isRetryableError(error)) {
          throw error;
        }
        
        if (attempt < maxRetries - 1) {
          const waitTime = isRateLimitError(error) 
            ? error.retryAfter 
            : backoffMs * Math.pow(2, attempt);
            
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }
}