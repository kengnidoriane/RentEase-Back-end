import request from 'supertest';
import app from '@/server';
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

describe('Security Tests', () => {
  beforeAll(async () => {
    // Ensure Redis is connected for rate limiting tests
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  });

  afterAll(async () => {
    // Clean up Redis keys
    const keys = await redisClient.keys('rate_limit:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS attempts in request body', async () => {
      const maliciousPayload = {
        email: 'test@example.com',
        firstName: '<script>alert("xss")</script>John',
        lastName: 'Doe<img src=x onerror=alert("xss")>',
        description: 'javascript:alert("xss")',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousPayload);

      // Should not contain script tags or javascript protocol
      expect(response.body).not.toMatch(/<script/i);
      expect(response.body).not.toMatch(/javascript:/i);
      expect(response.body).not.toMatch(/onerror/i);
    });

    it('should sanitize XSS attempts in query parameters', async () => {
      const response = await request(app)
        .get('/api/properties/search')
        .query({
          city: '<script>alert("xss")</script>Paris',
          propertyType: 'javascript:alert("xss")',
        });

      expect(response.status).toBeLessThan(500);
      // Response should not contain malicious scripts
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/<script/i);
      expect(responseText).not.toMatch(/javascript:/i);
    });

    it('should handle SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'--",
        "admin'/*",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'password123',
          });

        // Should not cause server error or expose database info
        expect(response.status).not.toBe(500);
        expect(response.body).not.toMatch(/database|sql|mysql|postgresql/i);
      }
    });
  });

  describe('Security Headers', () => {
    it('should set proper security headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should set HSTS header for HTTPS requests', async () => {
      const response = await request(app)
        .get('/health')
        .set('X-Forwarded-Proto', 'https');

      expect(response.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      // Clear rate limit keys before each test
      const keys = await redisClient.keys('rate_limit:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    });

    it('should enforce rate limits on authentication endpoints', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Make multiple requests to trigger rate limit
      const requests = Array(12).fill(null).map(() =>
        request(app).post('/api/auth/login').send(loginData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited response should have proper headers
      const rateLimitedResponse = rateLimitedResponses[0];
      expect(rateLimitedResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(rateLimitedResponse.headers['x-ratelimit-remaining']).toBe('0');
      expect(rateLimitedResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should enforce different rate limits for different endpoints', async () => {
      // Test general API rate limit (higher limit)
      const generalRequests = Array(5).fill(null).map(() =>
        request(app).get('/health')
      );

      const generalResponses = await Promise.all(generalRequests);
      const generalRateLimited = generalResponses.filter(r => r.status === 429);
      expect(generalRateLimited.length).toBe(0); // Should not be rate limited

      // Test auth rate limit (lower limit)
      const authRequests = Array(12).fill(null).map(() =>
        request(app).post('/api/auth/login').send({
          email: 'test@example.com',
          password: 'password',
        })
      );

      const authResponses = await Promise.all(authRequests);
      const authRateLimited = authResponses.filter(r => r.status === 429);
      expect(authRateLimited.length).toBeGreaterThan(0); // Should be rate limited
    });

    it('should include rate limit headers in responses', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(response.headers['x-ratelimit-window']).toBeDefined();
    });
  });

  describe('Authentication Security', () => {
    it('should reject requests with invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'Bearer invalid',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        null,
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', token || '');

        expect(response.status).toBe(401);
        expect(response.body.error.code).toMatch(/UNAUTHORIZED|TOKEN_INVALID|TOKEN_MISSING/);
      }
    });

    it('should reject requests with expired tokens', async () => {
      // This would require creating an expired token
      // For now, we'll test with a malformed token that looks expired
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', expiredToken);

      expect(response.status).toBe(401);
    });

    it('should validate password strength requirements', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'abc123',
        'Password', // Missing special character and number
        'password123', // Missing uppercase and special character
        'PASSWORD123!', // Missing lowercase
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password,
            firstName: 'John',
            lastName: 'Doe',
            phone: '+1234567890',
            userType: 'TENANT',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Request Size Limits', () => {
    it('should reject requests that exceed size limits', async () => {
      const largePayload = {
        email: 'test@example.com',
        description: 'x'.repeat(50 * 1024 * 1024), // 50MB string
      };

      const response = await request(app)
        .post('/api/properties')
        .send(largePayload);

      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('CORS Security', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .get('/api/properties')
        .set('Origin', 'http://malicious-site.com');

      // Should either reject or not include CORS headers for unauthorized origin
      if (response.headers['access-control-allow-origin']) {
        expect(response.headers['access-control-allow-origin']).not.toBe('http://malicious-site.com');
      }
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).not.toMatch(/stack|trace|error\.stack/i);
      expect(response.body).not.toMatch(/database|sql|connection/i);
      expect(response.body).not.toMatch(/password|secret|key/i);
    });

    it('should not expose database errors', async () => {
      // This test would require triggering a database error
      // For now, we'll test that 500 errors don't expose sensitive info
      const response = await request(app)
        .post('/api/auth/login')
        .send({}); // Invalid payload to potentially trigger error

      if (response.status === 500) {
        expect(response.body).not.toMatch(/database|sql|connection|prisma/i);
        expect(response.body).not.toMatch(/stack|trace/i);
      }
    });
  });

  describe('Security Logging', () => {
    it('should log suspicious requests', async () => {
      const logSpy = jest.spyOn(logger, 'warn');

      // Make a request with suspicious patterns
      await request(app)
        .get('/api/properties/../../../etc/passwd')
        .set('User-Agent', '<script>alert("xss")</script>');

      expect(logSpy).toHaveBeenCalledWith(
        'Suspicious request detected',
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('../'),
        })
      );

      logSpy.mockRestore();
    });

    it('should log failed authentication attempts', async () => {
      const logSpy = jest.spyOn(logger, 'warn');

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      // Should log authentication failure
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Authentication|Authorization/),
        expect.objectContaining({
          statusCode: expect.any(Number),
        })
      );

      logSpy.mockRestore();
    });
  });
});