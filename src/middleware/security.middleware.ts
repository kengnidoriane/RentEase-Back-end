import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

/**
 * Input sanitization middleware to prevent XSS attacks
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    next();
  }
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize a string to prevent XSS attacks
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    // Remove HTML tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    // Escape special characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    // Remove potentially dangerous patterns
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/onload/gi, '')
    .replace(/onerror/gi, '')
    .replace(/onclick/gi, '')
    .replace(/onmouseover/gi, '')
    // Trim whitespace
    .trim();
}

/**
 * Content Security Policy middleware
 */
export const contentSecurityPolicy = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for Swagger
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "child-src 'none'",
      "worker-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "manifest-src 'self'"
    ].join('; ')
  );
  next();
};

/**
 * Additional security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

/**
 * Request size limiting middleware
 */
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        res.status(413).json({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request size exceeds limit of ${maxSize}`,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }
    }
    
    next();
  };
};

/**
 * Parse size string to bytes
 */
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const value = parseFloat(match[1]!);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]!);
}

/**
 * IP whitelist middleware for admin endpoints
 */
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedIPs.length === 0) {
      // No IP restrictions if list is empty
      next();
      return;
    }
    
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
    const normalizedIP = Array.isArray(clientIP) ? clientIP[0] : clientIP;
    
    if (!normalizedIP || !allowedIPs.includes(normalizedIP)) {
      logger.warn('Unauthorized IP access attempt', {
        ip: normalizedIP,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied from this IP address',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
      return;
    }
    
    next();
  };
};

/**
 * Request logging middleware for security monitoring
 */
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//,  // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i, // JavaScript protocol
    /vbscript:/i, // VBScript protocol
  ];
  
  const url = req.originalUrl || req.url;
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));
  
  if (isSuspicious) {
    logger.warn('Suspicious request detected', {
      ip: req.ip,
      method: req.method,
      url,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
    });
  }
  
  // Override res.end to log response
  const originalEnd = res.end;
  (res as any).end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    // Log slow requests (potential DoS attempts)
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        ip: req.ip,
        method: req.method,
        url,
        duration,
        statusCode: res.statusCode,
      });
    }
    
    // Log failed authentication attempts
    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.warn('Authentication/Authorization failure', {
        ip: req.ip,
        method: req.method,
        url,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
      });
    }
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};