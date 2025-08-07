import * as crypto from 'crypto';
import { AIResponse, EmailContext, CacheConfig } from './interface';
import { CacheError } from './errors';

export interface CachedResponse {
  response: AIResponse;
  timestamp: number;
  hitCount: number;
  key: string;
}

export class ResponseCache {
  private cache: Map<string, CachedResponse>;
  private lru: string[];
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    errors: number;
  };

  constructor(private config: CacheConfig) {
    this.cache = new Map();
    this.lru = [];
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      errors: 0,
    };
  }

  async get(key: string): Promise<AIResponse | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const cached = this.cache.get(key);
      
      if (!cached) {
        this.stats.misses++;
        return null;
      }
      
      // Check if expired
      const age = Date.now() - cached.timestamp;
      if (age > this.config.ttl * 1000) {
        this.cache.delete(key);
        this.removeLRU(key);
        this.stats.misses++;
        return null;
      }
      
      // Update hit count and LRU
      cached.hitCount++;
      this.updateLRU(key);
      this.stats.hits++;
      
      return cached.response;
    } catch (error) {
      this.stats.errors++;
      throw new CacheError('Failed to retrieve from cache', 'read', error);
    }
  }

  async set(key: string, response: AIResponse): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Enforce size limit
      if (this.cache.size >= this.config.maxSize) {
        this.evictOldest();
      }
      
      this.cache.set(key, {
        response,
        timestamp: Date.now(),
        hitCount: 0,
        key,
      });
      
      this.updateLRU(key);
    } catch (error) {
      this.stats.errors++;
      throw new CacheError('Failed to set cache', 'write', error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const existed = this.cache.delete(key);
      if (existed) {
        this.removeLRU(key);
      }
      return existed;
    } catch (error) {
      this.stats.errors++;
      throw new CacheError('Failed to delete from cache', 'delete', error);
    }
  }

  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.lru = [];
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        errors: 0,
      };
    } catch (error) {
      throw new CacheError('Failed to clear cache', 'clear', error);
    }
  }

  getCacheKey(context: EmailContext): string {
    // Create deterministic cache key from email context
    const keyData = {
      from: context.from,
      subject: context.subject,
      body: context.body.substring(0, 200), // Use first 200 chars
      responseStyle: context.responseStyle || 'formal',
      maxLength: context.maxLength,
      includeSignature: context.includeSignature,
      threadLength: context.thread?.length || 0,
    };
    
    const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  getGenericCacheKey(input: any): string {
    const keyString = typeof input === 'string' 
      ? input 
      : JSON.stringify(input, this.stableStringify);
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  private stableStringify(key: string, value: any): any {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted: any, k: string) => {
          sorted[k] = value[k];
          return sorted;
        }, {});
    }
    return value;
  }

  private updateLRU(key: string): void {
    this.removeLRU(key);
    this.lru.push(key);
  }

  private removeLRU(key: string): void {
    const index = this.lru.indexOf(key);
    if (index > -1) {
      this.lru.splice(index, 1);
    }
  }

  private evictOldest(): void {
    if (this.lru.length === 0) {
      return;
    }
    
    const oldest = this.lru.shift();
    if (oldest) {
      this.cache.delete(oldest);
      this.stats.evictions++;
    }
  }

  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    errors: number;
    memoryUsage: number;
  } {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;
    
    // Estimate memory usage (rough approximation)
    let memoryUsage = 0;
    this.cache.forEach(cached => {
      memoryUsage += JSON.stringify(cached).length;
    });
    
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      evictions: this.stats.evictions,
      errors: this.stats.errors,
      memoryUsage,
    };
  }

  getEntries(): Map<string, CachedResponse> {
    return new Map(this.cache);
  }

  // Advanced cache operations
  async warmUp(keys: string[], loader: (key: string) => Promise<AIResponse>): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const promises = keys.map(async key => {
      const existing = await this.get(key);
      if (!existing) {
        try {
          const response = await loader(key);
          await this.set(key, response);
        } catch (error) {
          // Silently fail for warm-up operations
          console.error(`Failed to warm up cache for key ${key}:`, error);
        }
      }
    });
    
    await Promise.all(promises);
  }

  pruneExpired(): number {
    if (!this.config.enabled) {
      return 0;
    }

    const now = Date.now();
    let pruned = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      const age = now - cached.timestamp;
      if (age > this.config.ttl * 1000) {
        this.cache.delete(key);
        this.removeLRU(key);
        pruned++;
      }
    }
    
    return pruned;
  }
}

export class TieredCache extends ResponseCache {
  private hotCache: Map<string, CachedResponse>;
  private hotThreshold: number = 3; // Number of hits to promote to hot cache
  private hotCacheSize: number;

  constructor(config: CacheConfig) {
    super(config);
    this.hotCache = new Map();
    this.hotCacheSize = Math.floor(config.maxSize * 0.2); // 20% for hot cache
  }

  async get(key: string): Promise<AIResponse | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Check hot cache first
    const hotCached = this.hotCache.get(key);
    if (hotCached) {
      const age = Date.now() - hotCached.timestamp;
      if (age <= this.config.ttl * 1000) {
        hotCached.hitCount++;
        return hotCached.response;
      } else {
        this.hotCache.delete(key);
      }
    }
    
    // Check regular cache
    const response = await super.get(key);
    
    // Promote to hot cache if hit threshold reached
    if (response) {
      const cached = this.getEntries().get(key);
      if (cached && cached.hitCount >= this.hotThreshold) {
        this.promoteToHot(key, cached);
      }
    }
    
    return response;
  }

  private promoteToHot(key: string, cached: CachedResponse): void {
    // Enforce hot cache size limit
    if (this.hotCache.size >= this.hotCacheSize) {
      // Remove least recently used from hot cache
      const lruKey = this.hotCache.keys().next().value;
      if (lruKey) {
        this.hotCache.delete(lruKey);
      }
    }
    
    this.hotCache.set(key, cached);
  }

  getHotCacheStats(): {
    size: number;
    entries: string[];
  } {
    return {
      size: this.hotCache.size,
      entries: Array.from(this.hotCache.keys()),
    };
  }
}

export class DistributedCache extends ResponseCache {
  private localCache: ResponseCache;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    config: CacheConfig,
    private remoteStore?: {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string, ttl: number) => Promise<void>;
      delete: (key: string) => Promise<boolean>;
    }
  ) {
    super(config);
    this.localCache = new ResponseCache({
      ...config,
      ttl: Math.min(config.ttl, 300), // Local cache for max 5 minutes
    });
    
    if (remoteStore) {
      // Sync with remote store periodically
      this.syncInterval = setInterval(() => {
        this.syncWithRemote();
      }, 60000); // Every minute
    }
  }

  async get(key: string): Promise<AIResponse | null> {
    // Try local cache first
    const local = await this.localCache.get(key);
    if (local) {
      return local;
    }
    
    // Try remote store
    if (this.remoteStore) {
      try {
        const remoteData = await this.remoteStore.get(key);
        if (remoteData) {
          const response = JSON.parse(remoteData) as AIResponse;
          // Cache locally for faster subsequent access
          await this.localCache.set(key, response);
          return response;
        }
      } catch (error) {
        console.error('Failed to get from remote cache:', error);
      }
    }
    
    // Fall back to main cache
    return super.get(key);
  }

  async set(key: string, response: AIResponse): Promise<void> {
    // Set in all caches
    await Promise.all([
      super.set(key, response),
      this.localCache.set(key, response),
      this.setRemote(key, response),
    ]);
  }

  private async setRemote(key: string, response: AIResponse): Promise<void> {
    if (!this.remoteStore) {
      return;
    }
    
    try {
      await this.remoteStore.set(
        key,
        JSON.stringify(response),
        this.config.ttl
      );
    } catch (error) {
      console.error('Failed to set in remote cache:', error);
    }
  }

  private async syncWithRemote(): Promise<void> {
    // Implement cache synchronization logic
    // This is a placeholder for more complex sync strategies
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}