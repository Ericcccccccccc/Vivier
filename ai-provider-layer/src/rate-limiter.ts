import { RateLimitError } from './errors';
import { RateLimits, RateLimitStatus } from './interface';

export interface RateLimitWindow {
  requestCount: number;
  tokenCount: number;
  windowStart: number;
}

export class RateLimiter {
  private currentWindow: RateLimitWindow;
  private dailyWindow: RateLimitWindow;
  private readonly windowDuration = 60000; // 1 minute in ms
  private readonly dailyWindowDuration = 86400000; // 24 hours in ms

  constructor(private limits: RateLimits) {
    this.currentWindow = {
      requestCount: 0,
      tokenCount: 0,
      windowStart: Date.now(),
    };
    
    this.dailyWindow = {
      requestCount: 0,
      tokenCount: 0,
      windowStart: Date.now(),
    };
  }

  async checkLimit(): Promise<void> {
    this.resetWindowIfNeeded();
    
    // Check per-minute limits
    if (this.currentWindow.requestCount >= this.limits.requestsPerMinute) {
      const waitTime = this.getWaitTime();
      throw new RateLimitError(
        `Rate limit exceeded. ${this.limits.requestsPerMinute} requests per minute allowed.`,
        waitTime,
        'requests'
      );
    }
    
    if (this.currentWindow.tokenCount >= this.limits.tokensPerMinute) {
      const waitTime = this.getWaitTime();
      throw new RateLimitError(
        `Token limit exceeded. ${this.limits.tokensPerMinute} tokens per minute allowed.`,
        waitTime,
        'tokens'
      );
    }
    
    // Check daily limits if configured
    if (this.limits.requestsPerDay && 
        this.dailyWindow.requestCount >= this.limits.requestsPerDay) {
      const waitTime = this.getDailyWaitTime();
      throw new RateLimitError(
        `Daily request limit exceeded. ${this.limits.requestsPerDay} requests per day allowed.`,
        waitTime,
        'requests'
      );
    }
    
    if (this.limits.tokensPerDay && 
        this.dailyWindow.tokenCount >= this.limits.tokensPerDay) {
      const waitTime = this.getDailyWaitTime();
      throw new RateLimitError(
        `Daily token limit exceeded. ${this.limits.tokensPerDay} tokens per day allowed.`,
        waitTime,
        'tokens'
      );
    }
    
    // Increment request count
    this.currentWindow.requestCount++;
    this.dailyWindow.requestCount++;
  }

  recordUsage(tokens: number): void {
    this.resetWindowIfNeeded();
    this.currentWindow.tokenCount += tokens;
    this.dailyWindow.tokenCount += tokens;
  }

  async checkTokenLimit(estimatedTokens: number): Promise<void> {
    this.resetWindowIfNeeded();
    
    if (this.currentWindow.tokenCount + estimatedTokens > this.limits.tokensPerMinute) {
      const waitTime = this.getWaitTime();
      throw new RateLimitError(
        `Estimated tokens (${estimatedTokens}) would exceed limit. Current: ${this.currentWindow.tokenCount}/${this.limits.tokensPerMinute}`,
        waitTime,
        'tokens'
      );
    }
    
    if (this.limits.tokensPerDay && 
        this.dailyWindow.tokenCount + estimatedTokens > this.limits.tokensPerDay) {
      const waitTime = this.getDailyWaitTime();
      throw new RateLimitError(
        `Estimated tokens would exceed daily limit. Current: ${this.dailyWindow.tokenCount}/${this.limits.tokensPerDay}`,
        waitTime,
        'tokens'
      );
    }
  }

  getStatus(): RateLimitStatus {
    this.resetWindowIfNeeded();
    
    const now = Date.now();
    const windowEnd = this.currentWindow.windowStart + this.windowDuration;
    
    return {
      requestsRemaining: Math.max(0, this.limits.requestsPerMinute - this.currentWindow.requestCount),
      tokensRemaining: Math.max(0, this.limits.tokensPerMinute - this.currentWindow.tokenCount),
      resetTime: new Date(windowEnd),
      isLimited: this.isCurrentlyLimited(),
    };
  }

  isCurrentlyLimited(): boolean {
    this.resetWindowIfNeeded();
    
    return (
      this.currentWindow.requestCount >= this.limits.requestsPerMinute ||
      this.currentWindow.tokenCount >= this.limits.tokensPerMinute ||
      (this.limits.requestsPerDay !== undefined && 
       this.dailyWindow.requestCount >= this.limits.requestsPerDay) ||
      (this.limits.tokensPerDay !== undefined && 
       this.dailyWindow.tokenCount >= this.limits.tokensPerDay)
    );
  }

  reset(): void {
    const now = Date.now();
    this.currentWindow = {
      requestCount: 0,
      tokenCount: 0,
      windowStart: now,
    };
    this.dailyWindow = {
      requestCount: 0,
      tokenCount: 0,
      windowStart: now,
    };
  }

  private resetWindowIfNeeded(): void {
    const now = Date.now();
    
    // Reset minute window
    if (now - this.currentWindow.windowStart > this.windowDuration) {
      this.currentWindow = {
        requestCount: 0,
        tokenCount: 0,
        windowStart: now,
      };
    }
    
    // Reset daily window
    if (now - this.dailyWindow.windowStart > this.dailyWindowDuration) {
      this.dailyWindow = {
        requestCount: 0,
        tokenCount: 0,
        windowStart: now,
      };
    }
  }

  private getWaitTime(): number {
    const now = Date.now();
    const windowEnd = this.currentWindow.windowStart + this.windowDuration;
    return Math.max(0, windowEnd - now);
  }

  private getDailyWaitTime(): number {
    const now = Date.now();
    const windowEnd = this.dailyWindow.windowStart + this.dailyWindowDuration;
    return Math.max(0, windowEnd - now);
  }

  getUsageSummary(): {
    minute: { requests: number; tokens: number; percentUsed: number };
    daily?: { requests: number; tokens: number; percentUsed: number };
  } {
    this.resetWindowIfNeeded();
    
    const minuteUsage = {
      requests: this.currentWindow.requestCount,
      tokens: this.currentWindow.tokenCount,
      percentUsed: Math.max(
        (this.currentWindow.requestCount / this.limits.requestsPerMinute) * 100,
        (this.currentWindow.tokenCount / this.limits.tokensPerMinute) * 100
      ),
    };
    
    const result: any = { minute: minuteUsage };
    
    if (this.limits.requestsPerDay || this.limits.tokensPerDay) {
      result.daily = {
        requests: this.dailyWindow.requestCount,
        tokens: this.dailyWindow.tokenCount,
        percentUsed: Math.max(
          this.limits.requestsPerDay 
            ? (this.dailyWindow.requestCount / this.limits.requestsPerDay) * 100 
            : 0,
          this.limits.tokensPerDay 
            ? (this.dailyWindow.tokenCount / this.limits.tokensPerDay) * 100 
            : 0
        ),
      };
    }
    
    return result;
  }
}

export class AdaptiveRateLimiter extends RateLimiter {
  private errorCount: number = 0;
  private lastErrorTime: number = 0;
  private backoffMultiplier: number = 1;

  recordError(): void {
    const now = Date.now();
    
    // Reset error count if it's been more than 5 minutes since last error
    if (now - this.lastErrorTime > 300000) {
      this.errorCount = 0;
      this.backoffMultiplier = 1;
    }
    
    this.errorCount++;
    this.lastErrorTime = now;
    
    // Increase backoff multiplier based on error count
    if (this.errorCount > 3) {
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 10);
    }
  }

  recordSuccess(): void {
    // Gradually reduce backoff multiplier on success
    if (this.backoffMultiplier > 1) {
      this.backoffMultiplier = Math.max(1, this.backoffMultiplier * 0.9);
    }
  }

  async checkLimit(): Promise<void> {
    // Apply backoff multiplier to effectively reduce rate limits
    const adjustedLimits: RateLimits = {
      requestsPerMinute: Math.floor(this.limits.requestsPerMinute / this.backoffMultiplier),
      tokensPerMinute: Math.floor(this.limits.tokensPerMinute / this.backoffMultiplier),
      requestsPerDay: this.limits.requestsPerDay 
        ? Math.floor(this.limits.requestsPerDay / this.backoffMultiplier) 
        : undefined,
      tokensPerDay: this.limits.tokensPerDay 
        ? Math.floor(this.limits.tokensPerDay / this.backoffMultiplier) 
        : undefined,
    };
    
    // Create temporary limiter with adjusted limits
    const tempLimiter = new RateLimiter(adjustedLimits);
    Object.assign(tempLimiter, {
      currentWindow: this.currentWindow,
      dailyWindow: this.dailyWindow,
    });
    
    return tempLimiter.checkLimit();
  }
}