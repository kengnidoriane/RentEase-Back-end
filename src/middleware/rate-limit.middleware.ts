import { Request, Response, NextFunction } from 'express';
import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: Request) => string; // Custom key generator
  onLimitReached?: (req: Request, res: Response) => void; // Callback when limit is reached
}

interface RateLimitInfo {
  totalHits: number;
  totalHitsPerWindow: number;
  resetTime: Date;
  remainingRequests: number;
}

/**
 * Redis-based rate limiting middleware with Swagger documentation support
 */
export class RateLimitMiddleware {
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions) {
    this.options = {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
      message: options.message || 'Too many requests, please try again later',
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      onLimitReached: options.onLimitReached || (() => {}),
    };
  }

  /**
   * Default key generator using IP address and user ID if available
   */
  private defaultKeyGenerator(req: Request): string {
    const userId = (req as any).user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return userId ? `rate_limit:user:${userId}` : `rate_limit:ip:${ip}`;
  }

  /**
   * Get rate limit information for a key
   */
  private async getRateLimitInfo(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    // Use Redis sorted set to track requests with timestamps
    const pipeline = redisClient.multi();
    
    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    pipeline.zcard(key);
    
    // Set expiration for the key
    pipeline.expire(key, Math.ceil(this.options.windowMs / 1000));
    
    const results = await pipeline.exec();
    const totalHitsPerWindow = (results?.[1]?.[1] as number) || 0;
    
    const resetTime = new Date(now + this.options.windowMs);
    const remainingRequests = Math.max(0, this.options.maxRequests - totalHitsPerWindow);
    
    return {
      totalHits: totalHitsPerWindow,
      totalHitsPerWindow,
      resetTime,
      remainingRequests,
    };
  }

  /**
   * Record a request in Redis
   */
  private async recordRequest(key: string): Promise<void> {
    const now = Date.now();
    const pipeline = redisClient.multi();
    
    // Add current request with timestamp
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipeline.expire(key, Math.ceil(this.options.windowMs / 1000));
    
    await pipeline.exec();
  }

  /**
   * Create rate limiting middleware
   */
  public middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.options.keyGenerator(req);
        const rateLimitInfo = await this.getRateLimitInfo(key);
        
        // Add rate limit headers
        res.set({
          'X-RateLimit-Limit': this.options.maxRequests.toString(),
          'X-RateLimit-Remaining': rateLimitInfo.remainingRequests.toString(),
          'X-RateLimit-Reset': rateLimitInfo.resetTime.getTime().toString(),
          'X-RateLimit-Window': this.options.windowMs.toString(),
        });
        
        // Check if limit is exceeded
        if (rateLimitInfo.totalHitsPerWindow >= this.options.maxRequests) {
          logger.warn('Rate limit exceeded', {
            key,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
            totalHits: rateLimitInfo.totalHitsPerWindow,
            limit: this.options.maxRequests,
          });
          
          // Call custom callback if provided
          this.options.onLimitReached(req, res);
          
          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: this.options.message,
              details: {
                limit: this.options.maxRequests,
                windowMs: this.options.windowMs,
                resetTime: rateLimitInfo.resetTime.toISOString(),
                remainingRequests: 0,
              },
              timestamp: new Date().toISOString(),
              path: req.path,
            },
          });
          return;
        }
        
        // Record the request
        await this.recordRequest(key);
        
        // Add rate limit info to request for potential use in controllers
        (req as any).rateLimit = rateLimitInfo;
        
        next();
      } catch (error) {
        logger.error('Rate limiting error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        
        // Continue without rate limiting if Redis is down
        next();
      }
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  public async resetRateLimit(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Failed to reset rate limit', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get current rate limit status for a key
   */
  public async getRateLimitStatus(key: string): Promise<RateLimitInfo> {
    return this.getRateLimitInfo(key);
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // General API rate limit
  general: new RateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // 1000 requests per 15 minutes
    message: 'Too many requests from this IP, please try again later',
  }),

  // Authentication endpoints (more restrictive)
  auth: new RateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 login attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later',
  }),

  // Password reset (very restrictive)
  passwordReset: new RateLimitMiddleware({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 password reset requests per hour
    message: 'Too many password reset requests, please try again later',
  }),

  // File upload endpoints
  upload: new RateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
    message: 'Too many file uploads, please try again later',
  }),

  // Search endpoints
  search: new RateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 searches per minute
    message: 'Too many search requests, please try again later',
  }),

  // Messaging endpoints
  messaging: new RateLimitMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 messages per minute
    message: 'Too many messages sent, please slow down',
  }),

  // Admin endpoints (more permissive for admins)
  admin: new RateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 2000, // 2000 requests per 15 minutes
    message: 'Admin rate limit exceeded, please try again later',
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id;
      return userId ? `rate_limit:admin:${userId}` : `rate_limit:admin:${req.ip}`;
    },
  }),
};

/**
 * Middleware to add rate limit information to Swagger responses
 */
export const addRateLimitHeaders = (req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json;
  
  res.json = function (body: any) {
    // Add rate limit info to response if available
    if ((req as any).rateLimit) {
      const rateLimitInfo = (req as any).rateLimit as RateLimitInfo;
      
      // Add to response headers (already set by rate limit middleware)
      // This is just for documentation purposes
      if (body && typeof body === 'object' && body.meta) {
        body.meta.rateLimit = {
          limit: parseInt(res.get('X-RateLimit-Limit') || '0'),
          remaining: parseInt(res.get('X-RateLimit-Remaining') || '0'),
          reset: res.get('X-RateLimit-Reset'),
          window: res.get('X-RateLimit-Window'),
        };
      }
    }
    
    return originalJson.call(this, body);
  };
  
  next();
};