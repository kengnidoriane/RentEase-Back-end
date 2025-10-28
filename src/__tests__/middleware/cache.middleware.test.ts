import { Request, Response, NextFunction } from 'express';
import { CacheMiddleware, CacheConfigs, CacheInvalidator } from '@/middleware/cache.middleware';
import { redisClient } from '@/config/redis';

// Mock Redis client
jest.mock('@/config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    sAdd: jest.fn(),
    sMembers: jest.fn(),
    expire: jest.fn(),
    memory: jest.fn(),
  },
}));

describe('Cache Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSet: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockSet = jest.fn();

    mockReq = {
      method: 'GET',
      path: '/api/test',
      query: {},
      user: { id: 'user123' },
      get: jest.fn(),
    };

    mockRes = {
      json: mockJson,
      status: mockStatus,
      set: mockSet,
      statusCode: 200,
    };

    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('CacheMiddleware', () => {
    it('should cache GET requests', async () => {
      const cache = new CacheMiddleware({ ttl: 300 });
      const middleware = cache.middleware();

      // Mock cache miss
      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (redisClient.setEx as jest.Mock).mockResolvedValue('OK');

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Simulate response
      const responseData = { success: true, data: 'test' };
      mockRes.json!(responseData);

      expect(mockSet).toHaveBeenCalledWith({
        'X-Cache': 'MISS',
        'X-Cache-Key': expect.any(String),
        'Cache-Control': 'public, max-age=300',
      });
    });

    it('should return cached response on cache hit', async () => {
      const cache = new CacheMiddleware({ ttl: 300 });
      const middleware = cache.middleware();

      const cachedData = {
        statusCode: 200,
        body: { success: true, data: 'cached' },
        headers: { 'Content-Type': 'application/json' },
        timestamp: new Date().toISOString(),
      };

      // Mock cache hit
      (redisClient.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        'X-Cache': 'HIT',
        'X-Cache-Key': expect.any(String),
        'Cache-Control': 'public, max-age=300',
      });
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(cachedData.body);
    });

    it('should skip caching for non-GET requests', async () => {
      const cache = new CacheMiddleware({ ttl: 300 });
      const middleware = cache.middleware();

      mockReq.method = 'POST';

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(redisClient.get).not.toHaveBeenCalled();
    });

    it('should skip caching when skipCache condition is met', async () => {
      const cache = new CacheMiddleware({
        ttl: 300,
        skipCache: (req) => req.path === '/api/test',
      });
      const middleware = cache.middleware();

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(redisClient.get).not.toHaveBeenCalled();
    });

    it('should use custom key generator', async () => {
      const customKeyGenerator = jest.fn().mockReturnValue('custom:key');
      const cache = new CacheMiddleware({
        ttl: 300,
        keyGenerator: customKeyGenerator,
      });
      const middleware = cache.middleware();

      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(customKeyGenerator).toHaveBeenCalledWith(mockReq);
      expect(redisClient.get).toHaveBeenCalledWith('custom:key');
    });

    it('should handle Redis errors gracefully', async () => {
      const cache = new CacheMiddleware({ ttl: 300 });
      const middleware = cache.middleware();

      // Mock Redis error
      (redisClient.get as jest.Mock).mockRejectedValue(new Error('Redis error'));

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should vary cache by specified headers', async () => {
      const cache = new CacheMiddleware({
        ttl: 300,
        varyBy: ['Authorization', 'Accept-Language'],
      });
      const middleware = cache.middleware();

      (mockReq.get as jest.Mock)
        .mockReturnValueOnce('Bearer token123')
        .mockReturnValueOnce('en-US');

      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(redisClient.get).toHaveBeenCalledWith(
        expect.stringContaining('Authorization:Bearer token123|Accept-Language:en-US')
      );
    });

    it('should store and retrieve cache tags', async () => {
      const cache = new CacheMiddleware({
        ttl: 300,
        tags: ['properties', 'search'],
      });
      const middleware = cache.middleware();

      (redisClient.get as jest.Mock).mockResolvedValue(null);
      (redisClient.setEx as jest.Mock).mockResolvedValue('OK');
      (redisClient.sAdd as jest.Mock).mockResolvedValue(1);
      (redisClient.expire as jest.Mock).mockResolvedValue(1);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Simulate response
      mockRes.json!({ success: true });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(redisClient.sAdd).toHaveBeenCalledWith('tag_index:properties', expect.any(String));
      expect(redisClient.sAdd).toHaveBeenCalledWith('tag_index:search', expect.any(String));
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache by pattern', async () => {
      const cache = new CacheMiddleware({ ttl: 300 });

      (redisClient.keys as jest.Mock).mockResolvedValue(['cache:key1', 'cache:key2']);
      (redisClient.del as jest.Mock).mockResolvedValue(2);

      await cache.invalidateByPattern('cache:*');

      expect(redisClient.keys).toHaveBeenCalledWith('cache:*');
      expect(redisClient.del).toHaveBeenCalledWith(['cache:key1', 'cache:key2']);
    });

    it('should invalidate cache by tags', async () => {
      const cache = new CacheMiddleware({ ttl: 300 });

      (redisClient.sMembers as jest.Mock).mockResolvedValue(['cache:key1', 'cache:key2']);
      (redisClient.del as jest.Mock).mockResolvedValue(2);

      await cache.invalidateByTags(['properties']);

      expect(redisClient.sMembers).toHaveBeenCalledWith('tag_index:properties');
      expect(redisClient.del).toHaveBeenCalledWith(['cache:key1', 'cache:key2']);
    });

    it('should clear all cache entries', async () => {
      const cache = new CacheMiddleware({ ttl: 300 });

      (redisClient.keys as jest.Mock).mockResolvedValue(['cache:key1', 'cache:key2']);
      (redisClient.del as jest.Mock).mockResolvedValue(2);

      await cache.clearAll();

      expect(redisClient.keys).toHaveBeenCalledWith('cache:*');
      expect(redisClient.del).toHaveBeenCalledWith(['cache:key1', 'cache:key2']);
    });

    it('should get cache statistics', async () => {
      const cache = new CacheMiddleware({ ttl: 300 });

      (redisClient.keys as jest.Mock).mockResolvedValue(['cache:key1', 'cache:key2']);
      (redisClient.memory as jest.Mock).mockResolvedValue(1024);

      const stats = await cache.getStats();

      expect(stats.totalKeys).toBe(2);
      expect(stats.totalSize).toBe(2048); // 1024 * 2
    });
  });

  describe('Predefined Cache Configurations', () => {
    it('should have correct configuration for properties cache', () => {
      expect(CacheConfigs.properties).toBeInstanceOf(CacheMiddleware);
    });

    it('should have correct configuration for search cache', () => {
      expect(CacheConfigs.search).toBeInstanceOf(CacheMiddleware);
    });

    it('should have correct configuration for profile cache', () => {
      expect(CacheConfigs.profile).toBeInstanceOf(CacheMiddleware);
    });
  });

  describe('CacheInvalidator', () => {
    beforeEach(() => {
      // Mock the cache invalidation methods
      jest.spyOn(CacheConfigs.properties, 'invalidateByTags').mockResolvedValue();
      jest.spyOn(CacheConfigs.search, 'invalidateByTags').mockResolvedValue();
      jest.spyOn(CacheConfigs.profile, 'invalidateByTags').mockResolvedValue();
      jest.spyOn(CacheConfigs.properties, 'invalidateByPattern').mockResolvedValue();
      jest.spyOn(CacheConfigs.profile, 'invalidateByPattern').mockResolvedValue();
    });

    it('should invalidate property-related caches', async () => {
      await CacheInvalidator.invalidatePropertyCaches('property123');

      expect(CacheConfigs.properties.invalidateByTags).toHaveBeenCalledWith(['properties']);
      expect(CacheConfigs.search.invalidateByTags).toHaveBeenCalledWith(['search', 'properties']);
      expect(CacheConfigs.properties.invalidateByPattern).toHaveBeenCalledWith(
        'cache:*:properties/property123*'
      );
    });

    it('should invalidate user-related caches', async () => {
      await CacheInvalidator.invalidateUserCaches('user123');

      expect(CacheConfigs.profile.invalidateByTags).toHaveBeenCalledWith(['profile']);
      expect(CacheConfigs.profile.invalidateByPattern).toHaveBeenCalledWith(
        'cache:profile:user123:*'
      );
    });

    it('should invalidate admin caches', async () => {
      jest.spyOn(CacheConfigs.adminStats, 'invalidateByTags').mockResolvedValue();

      await CacheInvalidator.invalidateAdminCaches();

      expect(CacheConfigs.adminStats.invalidateByTags).toHaveBeenCalledWith(['admin', 'stats']);
    });

    it('should invalidate all caches', async () => {
      const clearAllSpies = [
        jest.spyOn(CacheConfigs.short, 'clearAll').mockResolvedValue(),
        jest.spyOn(CacheConfigs.medium, 'clearAll').mockResolvedValue(),
        jest.spyOn(CacheConfigs.long, 'clearAll').mockResolvedValue(),
        jest.spyOn(CacheConfigs.properties, 'clearAll').mockResolvedValue(),
        jest.spyOn(CacheConfigs.search, 'clearAll').mockResolvedValue(),
        jest.spyOn(CacheConfigs.profile, 'clearAll').mockResolvedValue(),
        jest.spyOn(CacheConfigs.adminStats, 'clearAll').mockResolvedValue(),
      ];

      await CacheInvalidator.invalidateAll();

      clearAllSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
    });
  });
});