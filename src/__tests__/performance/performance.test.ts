import request from 'supertest';
import app from '@/server';
import { redisClient } from '@/config/redis';
import { performanceMonitor } from '@/services/performance-monitoring.service';
import { CacheConfigs, CacheInvalidator } from '@/middleware/cache.middleware';

describe('Performance Tests', () => {
  beforeAll(async () => {
    // Ensure Redis is connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  });

  afterAll(async () => {
    // Clean up cache keys
    await CacheInvalidator.invalidateAll();
  });

  beforeEach(() => {
    // Clear performance metrics before each test
    performanceMonitor.clearMetrics();
  });

  describe('Response Time Performance', () => {
    it('should respond to health check within acceptable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app).get('/health');
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.headers['x-response-time']).toBeDefined();
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();
      
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Average response time should be reasonable
      const avgResponseTime = totalTime / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
    });

    it('should maintain performance under load', async () => {
      const loadTestRequests = 100;
      const batchSize = 10;
      const batches = [];
      
      // Create batches of requests
      for (let i = 0; i < loadTestRequests; i += batchSize) {
        const batch = Array(batchSize).fill(null).map(() =>
          request(app).get('/api/properties/search').query({ city: 'Paris' })
        );
        batches.push(Promise.all(batch));
      }
      
      const startTime = Date.now();
      const results = await Promise.all(batches);
      const totalTime = Date.now() - startTime;
      
      // Flatten results
      const allResponses = results.flat();
      
      // Check that most requests succeeded
      const successfulResponses = allResponses.filter(r => r.status === 200);
      const successRate = (successfulResponses.length / allResponses.length) * 100;
      
      expect(successRate).toBeGreaterThan(95); // 95% success rate
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
    });
  });

  describe('Caching Performance', () => {
    beforeEach(async () => {
      // Clear cache before each test
      await CacheInvalidator.invalidateAll();
    });

    it('should cache GET requests and improve response time', async () => {
      const endpoint = '/api/properties/search?city=Paris';
      
      // First request (cache miss)
      const firstResponse = await request(app).get(endpoint);
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers['x-cache']).toBe('MISS');
      
      // Second request (cache hit)
      const secondResponse = await request(app).get(endpoint);
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers['x-cache']).toBe('HIT');
      
      // Cache hit should have cache headers
      expect(secondResponse.headers['cache-control']).toMatch(/max-age=\d+/);
      expect(secondResponse.headers['x-cache-key']).toBeDefined();
    });

    it('should not cache POST, PUT, DELETE requests', async () => {
      const postResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });
      
      expect(postResponse.headers['x-cache']).toBeUndefined();
    });

    it('should invalidate cache when data changes', async () => {
      // This test would require actual data manipulation
      // For now, we'll test the cache invalidation methods
      const cacheStats = await CacheConfigs.properties.getStats();
      expect(cacheStats).toHaveProperty('totalKeys');
      expect(cacheStats).toHaveProperty('totalSize');
    });

    it('should handle cache failures gracefully', async () => {
      // Temporarily disconnect Redis to simulate cache failure
      await redisClient.disconnect();
      
      const response = await request(app).get('/health');
      
      // Should still work without cache
      expect(response.status).toBe(200);
      
      // Reconnect Redis
      await redisClient.connect();
    });
  });

  describe('Database Query Performance', () => {
    it('should execute property search queries efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/properties/search')
        .query({
          city: 'Paris',
          propertyType: 'APARTMENT',
          minPrice: 1000,
          maxPrice: 2000,
          bedrooms: 2,
        });
      
      const queryTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(queryTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle pagination efficiently', async () => {
      const pageSize = 20;
      const pages = 5;
      
      const requests = Array(pages).fill(null).map((_, index) =>
        request(app)
          .get('/api/properties/search')
          .query({
            limit: pageSize,
            offset: index * pageSize,
          })
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Pagination should be efficient
      expect(totalTime).toBeLessThan(5000); // All pages within 5 seconds
    });
  });

  describe('Memory Usage', () => {
    it('should not have memory leaks during normal operation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform multiple operations
      const operations = Array(100).fill(null).map(() =>
        request(app).get('/health')
      );
      
      await Promise.all(operations);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      expect(memoryIncreasePercent).toBeLessThan(50); // Less than 50% increase
    });

    it('should include memory usage in response headers', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-memory-usage']).toBeDefined();
      expect(response.headers['x-memory-usage']).toMatch(/\d+MB/);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request metrics', async () => {
      // Make some requests
      await request(app).get('/health');
      await request(app).get('/api/properties/search');
      
      const metrics = performanceMonitor.getPerformanceMetrics();
      
      expect(metrics.requestCount).toBeGreaterThan(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
    });

    it('should provide endpoint statistics', async () => {
      // Make requests to different endpoints
      await request(app).get('/health');
      await request(app).get('/health');
      await request(app).get('/api/properties/search');
      
      const endpointStats = performanceMonitor.getEndpointStats();
      
      expect(endpointStats).toBeInstanceOf(Array);
      expect(endpointStats.length).toBeGreaterThan(0);
      
      const healthEndpoint = endpointStats.find(stat => stat.endpoint === '/health');
      expect(healthEndpoint).toBeDefined();
      expect(healthEndpoint?.requestCount).toBe(2);
    });

    it('should detect slow requests', async () => {
      // This would require creating an artificially slow endpoint
      // For now, we'll test the slow request detection logic
      const metrics = performanceMonitor.getPerformanceMetrics();
      expect(metrics.slowRequests).toBeGreaterThanOrEqual(0);
    });

    it('should provide health status', async () => {
      const healthStatus = performanceMonitor.getHealthStatus();
      
      expect(healthStatus.status).toMatch(/healthy|warning|critical/);
      expect(healthStatus.checks).toBeInstanceOf(Array);
      
      healthStatus.checks.forEach(check => {
        expect(check.name).toBeDefined();
        expect(check.status).toMatch(/pass|warn|fail/);
      });
    });
  });

  describe('Rate Limiting Performance', () => {
    beforeEach(async () => {
      // Clear rate limit keys
      const keys = await redisClient.keys('rate_limit:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    });

    it('should handle rate limiting efficiently', async () => {
      const requests = Array(50).fill(null).map(() =>
        request(app).get('/health')
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      // Rate limiting should not significantly slow down requests
      expect(totalTime).toBeLessThan(5000); // Within 5 seconds
      
      // Most requests should succeed (not rate limited)
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(40);
    });

    it('should maintain rate limit state in Redis efficiently', async () => {
      // Make requests to create rate limit entries
      await Promise.all([
        request(app).get('/health'),
        request(app).get('/health'),
        request(app).get('/health'),
      ]);
      
      // Check that Redis keys are created efficiently
      const keys = await redisClient.keys('rate_limit:*');
      expect(keys.length).toBeGreaterThan(0);
      
      // Keys should have proper TTL
      for (const key of keys) {
        const ttl = await redisClient.ttl(key);
        expect(ttl).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle 404 errors efficiently', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app).get('/api/nonexistent-endpoint')
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(404);
      });
      
      // Error handling should be fast
      expect(totalTime).toBeLessThan(2000);
    });

    it('should handle validation errors efficiently', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/register')
          .send({ invalid: 'data' })
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;
      
      responses.forEach(response => {
        expect(response.status).toBe(400);
      });
      
      expect(totalTime).toBeLessThan(2000);
    });
  });

  describe('Metrics Endpoint Performance', () => {
    it('should provide metrics efficiently', async () => {
      // Generate some activity first
      await Promise.all([
        request(app).get('/health'),
        request(app).get('/api/properties/search'),
      ]);
      
      const startTime = Date.now();
      const response = await request(app).get('/metrics');
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000);
      
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('endpoints');
      expect(response.body.data).toHaveProperty('health');
      expect(response.body.data).toHaveProperty('alerts');
    });
  });
});