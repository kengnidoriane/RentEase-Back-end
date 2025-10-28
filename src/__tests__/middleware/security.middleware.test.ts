import { Request, Response, NextFunction } from 'express';
import {
  sanitizeInput,
  contentSecurityPolicy,
  securityHeaders,
  requestSizeLimit,
  securityLogger,
} from '@/middleware/security.middleware';

describe('Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockSetHeader: jest.Mock;
  let mockSet: jest.Mock;

  beforeEach(() => {
    mockSetHeader = jest.fn();
    mockSet = jest.fn();
    
    mockReq = {
      body: {},
      query: {},
      params: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn(),
      originalUrl: '/test',
      url: '/test',
      connection: { remoteAddress: '127.0.0.1' } as any,
    };

    mockRes = {
      setHeader: mockSetHeader,
      set: mockSet,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
      statusCode: 200,
    };

    mockNext = jest.fn();
  });

  describe('sanitizeInput', () => {
    it('should sanitize XSS attempts in request body', () => {
      mockReq.body = {
        name: '<script>alert("xss")</script>John',
        description: 'javascript:alert("xss")',
        email: 'test@example.com<img src=x onerror=alert("xss")>',
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.name).not.toContain('<script>');
      expect(mockReq.body.name).not.toContain('alert');
      expect(mockReq.body.description).not.toContain('javascript:');
      expect(mockReq.body.email).not.toContain('<img');
      expect(mockReq.body.email).not.toContain('onerror');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize XSS attempts in query parameters', () => {
      mockReq.query = {
        search: '<script>alert("xss")</script>',
        filter: 'javascript:void(0)',
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query['search']).not.toContain('<script>');
      expect(mockReq.query['filter']).not.toContain('javascript:');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should sanitize XSS attempts in URL parameters', () => {
      mockReq.params = {
        id: '<script>alert("xss")</script>',
        slug: 'test<img src=x onerror=alert("xss")>',
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.params['id']).not.toContain('<script>');
      expect(mockReq.params['slug']).not.toContain('<img');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      mockReq.body = {
        user: {
          profile: {
            bio: '<script>alert("xss")</script>',
          },
        },
        tags: ['<script>alert("xss")</script>', 'normal-tag'],
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.user.profile.bio).not.toContain('<script>');
      expect(mockReq.body.tags[0]).not.toContain('<script>');
      expect(mockReq.body.tags[1]).toBe('normal-tag');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle null and undefined values', () => {
      mockReq.body = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        number: 123,
      };

      sanitizeInput(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.nullValue).toBeNull();
      expect(mockReq.body.undefinedValue).toBeUndefined();
      expect(mockReq.body.emptyString).toBe('');
      expect(mockReq.body.number).toBe(123);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('contentSecurityPolicy', () => {
    it('should set Content-Security-Policy header', () => {
      contentSecurityPolicy(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should include all required CSP directives', () => {
      contentSecurityPolicy(mockReq as Request, mockRes as Response, mockNext);

      const cspHeader = mockSetHeader.mock.calls[0][1];
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toContain("script-src 'self'");
      expect(cspHeader).toContain("style-src 'self'");
      expect(cspHeader).toContain("img-src 'self' data: https:");
      expect(cspHeader).toContain("object-src 'none'");
      expect(cspHeader).toContain("frame-ancestors 'none'");
    });
  });

  describe('securityHeaders', () => {
    it('should set all security headers', () => {
      securityHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockSetHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockSetHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockSetHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=()'
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set HSTS header for HTTPS requests', () => {
      (mockReq as any).secure = true;

      securityHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    });

    it('should set HSTS header for X-Forwarded-Proto HTTPS', () => {
      mockReq.headers = { 'x-forwarded-proto': 'https' };

      securityHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSetHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    });
  });

  describe('requestSizeLimit', () => {
    it('should allow requests within size limit', () => {
      mockReq.headers = { 'content-length': '1000' }; // 1KB

      const middleware = requestSizeLimit('10mb');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject requests exceeding size limit', () => {
      mockReq.headers = { 'content-length': '50000000' }; // 50MB

      const middleware = requestSizeLimit('10mb');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request size exceeds limit of 10mb',
          timestamp: expect.any(String),
          path: '/test',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle requests without content-length header', () => {
      mockReq.headers = {};

      const middleware = requestSizeLimit('10mb');
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should parse different size units correctly', () => {
      const testCases = [
        { size: '1kb', contentLength: '2000', shouldPass: false },
        { size: '1mb', contentLength: '500000', shouldPass: true },
        { size: '1gb', contentLength: '500000000', shouldPass: true },
      ];

      testCases.forEach(({ size, contentLength, shouldPass }) => {
        mockReq.headers = { 'content-length': contentLength };
        mockRes.status = jest.fn().mockReturnThis();
        mockRes.json = jest.fn().mockReturnThis();
        mockNext = jest.fn();

        const middleware = requestSizeLimit(size);
        middleware(mockReq as Request, mockRes as Response, mockNext);

        if (shouldPass) {
          expect(mockNext).toHaveBeenCalled();
        } else {
          expect(mockRes.status).toHaveBeenCalledWith(413);
        }
      });
    });
  });

  describe('securityLogger', () => {
    it('should detect suspicious patterns in URL', () => {
      mockReq.originalUrl = '/api/users/../../../etc/passwd';
      mockReq.get = jest.fn().mockReturnValue('Mozilla/5.0');

      const logSpy = jest.spyOn(require('@/utils/logger').logger, 'warn').mockImplementation();

      securityLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(logSpy).toHaveBeenCalledWith(
        'Suspicious request detected',
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('../'),
        })
      );

      logSpy.mockRestore();
    });

    it('should detect XSS attempts in URL', () => {
      mockReq.originalUrl = '/api/search?q=<script>alert("xss")</script>';

      const logSpy = jest.spyOn(require('@/utils/logger').logger, 'warn').mockImplementation();

      securityLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(logSpy).toHaveBeenCalledWith(
        'Suspicious request detected',
        expect.objectContaining({
          url: expect.stringContaining('<script'),
        })
      );

      logSpy.mockRestore();
    });

    it('should log slow requests', (done) => {
      const logSpy = jest.spyOn(require('@/utils/logger').logger, 'warn').mockImplementation();

      // Mock res.end to simulate slow response
      (mockRes as any).end = function(_chunk?: any, _encoding?: any) {
        // Simulate 6 second delay
        setTimeout(() => {
          expect(logSpy).toHaveBeenCalledWith(
            'Slow request detected',
            expect.objectContaining({
              duration: expect.any(Number),
            })
          );
          logSpy.mockRestore();
          done();
        }, 0);
        return this;
      };

      securityLogger(mockReq as Request, mockRes as Response, mockNext);

      // Simulate the request taking a long time
      setTimeout(() => {
        (mockRes.end as any)();
      }, 5100); // Simulate 5.1 second response time
    });

    it('should log authentication failures', () => {
      const logSpy = jest.spyOn(require('@/utils/logger').logger, 'warn').mockImplementation();

      mockRes.statusCode = 401;
      (mockRes as any).end = function(_chunk?: any, _encoding?: any) {
        expect(logSpy).toHaveBeenCalledWith(
          'Authentication/Authorization failure',
          expect.objectContaining({
            statusCode: 401,
          })
        );
        logSpy.mockRestore();
        return this;
      };

      securityLogger(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.end as any)();
    });
  });
});