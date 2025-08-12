/**
 * Base class for all database-related errors
 */
export class DatabaseError extends Error {
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, public override cause?: any, context?: Record<string, any>) {
    super(message);
    this.name = 'DatabaseError';
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      cause: this.cause,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when database connection fails
 */
export class DatabaseConnectionError extends DatabaseError {
  public readonly retry: boolean = true;
  public readonly retryAfter: number = 5000; // milliseconds

  constructor(message: string, cause?: any, retryAfter?: number) {
    super(message, cause);
    this.name = 'DatabaseConnectionError';
    if (retryAfter !== undefined) {
      this.retryAfter = retryAfter;
    }
  }
}

/**
 * Error thrown when a database operation fails
 */
export class DatabaseOperationError extends DatabaseError {
  public readonly retry: boolean = false;
  public readonly operation?: string;

  constructor(message: string, cause?: any, operation?: string) {
    super(message, cause, { operation });
    this.name = 'DatabaseOperationError';
    this.operation = operation;
  }
}

/**
 * Error thrown when data validation fails
 */
export class ValidationError extends DatabaseError {
  public readonly fields?: Record<string, string[]>;

  constructor(message: string, fields?: Record<string, string[]>) {
    super(message, undefined, { fields });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * Error thrown when a transaction fails
 */
export class TransactionError extends DatabaseError {
  public readonly rollbackSuccessful: boolean;

  constructor(message: string, cause?: any, rollbackSuccessful: boolean = false) {
    super(message, cause, { rollbackSuccessful });
    this.name = 'TransactionError';
    this.rollbackSuccessful = rollbackSuccessful;
  }
}

/**
 * Error thrown when an entity is not found
 */
export class NotFoundError extends DatabaseError {
  public readonly entityType: string;
  public readonly entityId?: string;

  constructor(entityType: string, entityId?: string) {
    const message = entityId
      ? `${entityType} with ID ${entityId} not found`
      : `${entityType} not found`;
    super(message, undefined, { entityType, entityId });
    this.name = 'NotFoundError';
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

/**
 * Error thrown when a unique constraint is violated
 */
export class DuplicateError extends DatabaseError {
  public readonly field: string;
  public readonly value: any;

  constructor(field: string, value: any) {
    super(`Duplicate value for field ${field}: ${value}`, undefined, { field, value });
    this.name = 'DuplicateError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends DatabaseError {
  public readonly retryAfter: number;
  public readonly limit: number;

  constructor(message: string, limit: number, retryAfter: number) {
    super(message, undefined, { limit, retryAfter });
    this.name = 'RateLimitError';
    this.limit = limit;
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when usage limit is exceeded
 */
export class UsageLimitError extends DatabaseError {
  public readonly metric: string;
  public readonly limit: number;
  public readonly current: number;

  constructor(metric: string, limit: number, current: number) {
    super(
      `Usage limit exceeded for ${metric}: ${current}/${limit}`,
      undefined,
      { metric, limit, current }
    );
    this.name = 'UsageLimitError';
    this.metric = metric;
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends DatabaseError {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends DatabaseError {
  public readonly resource?: string;
  public readonly action?: string;

  constructor(message: string = 'Authorization failed', resource?: string, action?: string) {
    super(message, undefined, { resource, action });
    this.name = 'AuthorizationError';
    this.resource = resource;
    this.action = action;
  }
}

/**
 * Error thrown when database timeout occurs
 */
export class TimeoutError extends DatabaseError {
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`Database operation timed out after ${timeoutMs}ms: ${operation}`, undefined, {
      operation,
      timeoutMs,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Helper function to determine if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof DatabaseConnectionError) return error.retry;
  if (error instanceof DatabaseOperationError) return error.retry;
  if (error instanceof TimeoutError) return true;
  if (error instanceof RateLimitError) return true;
  
  // Check for common retryable error codes
  const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
  if (error.code && retryableCodes.includes(error.code)) return true;
  
  return false;
}

/**
 * Helper function to get retry delay
 */
export function getRetryDelay(error: any, attempt: number, baseDelay: number = 1000): number {
  if (error instanceof DatabaseConnectionError) return error.retryAfter;
  if (error instanceof RateLimitError) return error.retryAfter;
  
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}

/**
 * Wraps an async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // If it's already a DatabaseError, re-throw it
    if (error instanceof DatabaseError) {
      throw error;
    }
    
    // Convert to appropriate DatabaseError
    if (error instanceof Error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        throw new DuplicateError('unknown', error.message);
      }
      if (error.message.includes('not found')) {
        throw new NotFoundError(context);
      }
      if (error.message.includes('timeout')) {
        throw new TimeoutError(context, 30000);
      }
      if (error.message.includes('auth')) {
        throw new AuthenticationError(error.message);
      }
    }
    
    // Generic database operation error
    throw new DatabaseOperationError(`Failed to ${context}`, error, context);
  }
}