/**
 * Redis Client for Caching
 * Provides caching layer for OJS API calls and other data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory fallback when Redis is not available
const memoryCache = new Map<string, CacheEntry<unknown>>();

export interface RedisConfig {
  url?: string;
  ttl?: number; // Time to live in seconds
}

export class CacheClient {
  private redisUrl: string | null;
  private defaultTTL: number;
  private isConnected: boolean = false;

  constructor(config: RedisConfig = {}) {
    this.redisUrl = config.url || process.env.REDIS_URL || null;
    this.defaultTTL = config.ttl || 300; // 5 minutes default
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    // Use memory cache as fallback
    const entry = memoryCache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.defaultTTL) * 1000;
    memoryCache.set(key, { data: value, expiresAt });
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    memoryCache.delete(key);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    memoryCache.clear();
  }

  /**
   * Get or set with callback
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
  }
}

// Cache keys
export const CACHE_KEYS = {
  OJS_STATS: 'ojs:stats',
  OJS_SUBMISSIONS: 'ojs:submissions',
  OJS_SUBMISSION: (id: number) => `ojs:submission:${id}`,
  ARTICLES: 'articles:all',
  ARTICLE: (id: string) => `articles:${id}`,
  USER_SESSION: (userId: string) => `session:${userId}`,
} as const;

// Default cache TTLs in seconds
export const CACHE_TTL = {
  OJS_STATS: 300, // 5 minutes
  OJS_SUBMISSIONS: 120, // 2 minutes
  OJS_SUBMISSION: 180, // 3 minutes
  ARTICLES: 60, // 1 minute
  USER_SESSION: 3600, // 1 hour
} as const;

// Singleton instance
let cacheInstance: CacheClient | null = null;

export function getCache(): CacheClient {
  if (!cacheInstance) {
    cacheInstance = new CacheClient();
  }
  return cacheInstance;
}

export function createCache(config: RedisConfig): CacheClient {
  return new CacheClient(config);
}
