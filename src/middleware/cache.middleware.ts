import { Request, Response, NextFunction } from 'express';
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

interface CacheOptions {
  ttl: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
  varyBy?: string[]; // Headers to vary cache by
  tags?: string[]; // Cache tags for invalidation
}

/**
 * Redis-based response caching middleware
 */
export class CacheMiddleware {
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions) {
    this.options = {
      ttl: options.ttl,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      skipCache: options.skipCache || (() => false),
      varyBy: options.varyBy || [],
      tags: options.tags || [],
    };
  }

  /**
   * Default cache key generator
   */
  private defaultKeyGenerator(req: Request): string {
    const userId = (req as any).user?.id || 'anonymous';
    const queryString = new URLSearchParams(req.query as any).toString();
    const varyHeaders = this.options.varyBy
      .map(header => `${header}:${req.get(header) || ''}`)
      .join('|');

    return `cache:${req.method}:${req.path}:${queryString}:${userId}:${varyHeaders}`;
  }

  /**
   * Generate cache tags key
   */
  private getTagsKey(cacheKey: string): string {
    return `${cacheKey}:tags`;
  }

  /**
   * Store cache tags
   */
  private async storeCacheTags(cacheKey: string, tags: string[]): Promise<void> {
    if (tags.length === 0) return;

    try {
      const tagsKey = this.getTagsKey(cacheKey);
      await redisClient.setEx(tagsKey, this.options.ttl, JSON.stringify(tags));

      // Add to tag index for invalidation
      for (const tag of tags) {
        const tagIndexKey = `tag_index:${tag}`;
        await redisClient.sAdd(tagIndexKey, cacheKey);
        await redisClient.expire(tagIndexKey, this.options.ttl);
      }
    } catch (error) {
      logger.error('Failed to store cache tags:', error);
    }
  }

  /**
   * Create caching middleware
   */
  public middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        next();
        return;
      }

      // Skip caching if condition is met
      if (this.options.skipCache(req)) {
        next();
        return;
      }

      try {
        const cacheKey = this.options.keyGenerator(req);

        // Try to get cached response
        const cachedResponse = await redisClient.get(cacheKey);

        if (cachedResponse) {
          const parsed = JSON.parse(cachedResponse);

          // Set cached headers
          if (parsed.headers) {
            Object.entries(parsed.headers).forEach(([key, value]) => {
              res.set(key, value as string);
            });
          }

          // Add cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': cacheKey,
            'Cache-Control': `public, max-age=${this.options.ttl}`,
          });

          logger.debug('Cache hit', { cacheKey, path: req.path });

          res.status(parsed.statusCode).json(parsed.body);
          return;
        }

        // Cache miss - intercept response
        const originalJson = res.json;
        const originalStatus = res.status;
        let statusCode = 200;

        res.status = function (code: number) {
          statusCode = code;
          return originalStatus.call(this, code);
        };

        const self = this;
        res.json = function (body: any) {
          // Only cache successful responses
          if (statusCode >= 200 && statusCode < 300) {
            const responseData = {
              statusCode,
              body,
              headers: {
                'Content-Type': 'application/json',
              },
              timestamp: new Date().toISOString(),
            };

            // Store in cache asynchronously
            redisClient.setEx(cacheKey, self.options.ttl, JSON.stringify(responseData))
              .then(async () => {
                await self.storeCacheTags(cacheKey, self.options.tags);
                logger.debug('Response cached', { cacheKey, path: req.path, ttl: self.options.ttl });
              })
              .catch(error => {
                logger.error('Failed to cache response:', error);
              });

            // Add cache headers
            res.set({
              'X-Cache': 'MISS',
              'X-Cache-Key': cacheKey,
              'Cache-Control': `public, max-age=${self.options.ttl}`,
            });
          }

          return originalJson.call(this, body);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Invalidate cache by key pattern
   */
  public async invalidateByPattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Invalidated ${keys.length} cache entries`, { pattern });
      }
    } catch (error) {
      logger.error('Failed to invalidate cache by pattern:', error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagIndexKey = `tag_index:${tag}`;
        const cacheKeys = await redisClient.sMembers(tagIndexKey);

        if (cacheKeys.length > 0) {
          // Delete cache entries
          await redisClient.del(cacheKeys);

          // Delete tag entries
          const tagKeys = cacheKeys.map(key => this.getTagsKey(key));
          await redisClient.del(tagKeys);

          // Delete tag index
          await redisClient.del(tagIndexKey);

          logger.info(`Invalidated ${cacheKeys.length} cache entries by tag`, { tag });
        }
      }
    } catch (error) {
      logger.error('Failed to invalidate cache by tags:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  public async clearAll(): Promise<void> {
    try {
      const keys = await redisClient.keys('cache:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    totalKeys: number;
    totalSize: number;
    hitRate?: number;
  }> {
    try {
      const keys = await redisClient.keys('cache:*');
      let totalSize = 0;

      for (const key of keys) {
        try {
          // Redis memory command might not be available in all versions
          const size = await (redisClient as any).memory?.('USAGE', key) || 0;
          totalSize += size;
        } catch {
          // Fallback if memory command is not available
          totalSize += 100; // Estimate 100 bytes per key
        }
      }

      return {
        totalKeys: keys.length,
        totalSize,
      };
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return { totalKeys: 0, totalSize: 0 };
    }
  }
}

/**
 * Predefined cache configurations
 */
export const CacheConfigs = {
  // Short-term cache for frequently accessed data
  short: new CacheMiddleware({
    ttl: 5 * 60, // 5 minutes
    tags: ['short-term'],
  }),

  // Medium-term cache for semi-static data
  medium: new CacheMiddleware({
    ttl: 30 * 60, // 30 minutes
    tags: ['medium-term'],
  }),

  // Long-term cache for static data
  long: new CacheMiddleware({
    ttl: 60 * 60, // 1 hour
    tags: ['long-term'],
  }),

  // Property listings cache
  properties: new CacheMiddleware({
    ttl: 10 * 60, // 10 minutes
    tags: ['properties'],
    varyBy: ['Authorization'], // Vary by user
  }),

  // Search results cache
  search: new CacheMiddleware({
    ttl: 5 * 60, // 5 minutes
    tags: ['search', 'properties'],
    skipCache: (req) => {
      // Skip cache for authenticated users to show personalized results
      return !!(req as any).user;
    },
  }),

  // User profile cache
  profile: new CacheMiddleware({
    ttl: 15 * 60, // 15 minutes
    tags: ['profile'],
    keyGenerator: (req) => {
      const userId = (req as any).user?.id;
      return `cache:profile:${userId}:${req.path}`;
    },
  }),

  // Admin statistics cache
  adminStats: new CacheMiddleware({
    ttl: 5 * 60, // 5 minutes
    tags: ['admin', 'stats'],
  }),
};

/**
 * Cache invalidation helper
 */
export class CacheInvalidator {
  /**
   * Invalidate property-related caches
   */
  static async invalidatePropertyCaches(propertyId?: string): Promise<void> {
    await CacheConfigs.properties.invalidateByTags(['properties']);
    await CacheConfigs.search.invalidateByTags(['search', 'properties']);

    if (propertyId) {
      await CacheConfigs.properties.invalidateByPattern(`cache:*:properties/${propertyId}*`);
    }
  }

  /**
   * Invalidate user-related caches
   */
  static async invalidateUserCaches(userId?: string): Promise<void> {
    await CacheConfigs.profile.invalidateByTags(['profile']);

    if (userId) {
      await CacheConfigs.profile.invalidateByPattern(`cache:profile:${userId}:*`);
    }
  }

  /**
   * Invalidate admin caches
   */
  static async invalidateAdminCaches(): Promise<void> {
    await CacheConfigs.adminStats.invalidateByTags(['admin', 'stats']);
  }

  /**
   * Invalidate all caches
   */
  static async invalidateAll(): Promise<void> {
    const caches = [
      CacheConfigs.short,
      CacheConfigs.medium,
      CacheConfigs.long,
      CacheConfigs.properties,
      CacheConfigs.search,
      CacheConfigs.profile,
      CacheConfigs.adminStats,
    ];

    await Promise.all(caches.map(cache => cache.clearAll()));
  }
}