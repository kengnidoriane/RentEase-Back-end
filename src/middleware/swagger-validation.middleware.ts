import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '@/utils/logger';

/**
 * Enhanced validation middleware that provides detailed error responses
 * compatible with Swagger documentation standards
 */
export class SwaggerValidationMiddleware {
  /**
   * Validate request body against Zod schema
   */
  static validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validatedData = schema.parse(req.body);
        req.body = validatedData;
        next();
      } catch (error) {
        SwaggerValidationMiddleware.handleValidationError(error, req, res, 'body');
      }
    };
  }

  /**
   * Validate query parameters against Zod schema
   */
  static validateQuery(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validatedData = schema.parse(req.query);
        req.query = validatedData;
        next();
      } catch (error) {
        SwaggerValidationMiddleware.handleValidationError(error, req, res, 'query');
      }
    };
  }

  /**
   * Validate URL parameters against Zod schema
   */
  static validateParams(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validatedData = schema.parse(req.params);
        req.params = validatedData;
        next();
      } catch (error) {
        SwaggerValidationMiddleware.handleValidationError(error, req, res, 'params');
      }
    };
  }

  /**
   * Validate request headers against Zod schema
   */
  static validateHeaders(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const validatedData = schema.parse(req.headers);
        req.headers = validatedData;
        next();
      } catch (error) {
        SwaggerValidationMiddleware.handleValidationError(error, req, res, 'headers');
      }
    };
  }

  /**
   * Comprehensive validation for multiple request parts
   */
  static validateRequest(schemas: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
    headers?: ZodSchema;
  }) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const errors: Array<{ location: string; field: string; message: string }> = [];

      // Validate each part of the request
      Object.entries(schemas).forEach(([location, schema]) => {
        if (schema) {
          try {
            const data = req[location as keyof Request];
            const validatedData = schema.parse(data);
            (req as any)[location] = validatedData;
          } catch (error) {
            if (error instanceof ZodError) {
              const locationErrors = error.errors.map((err) => ({
                location,
                field: err.path.join('.'),
                message: err.message,
              }));
              errors.push(...locationErrors);
            }
          }
        }
      });

      if (errors.length > 0) {
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors,
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      next();
    };
  }

  /**
   * Handle validation errors consistently
   */
  private static handleValidationError(
    error: unknown,
    req: Request,
    res: Response,
    location: string
  ): void {
    if (error instanceof ZodError) {
      const validationErrors = error.errors.map((err) => ({
        location,
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
        // received: err.received, // This property doesn't exist on all ZodIssue types
      }));

      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        location,
        errors: validationErrors,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid ${location} data`,
          details: validationErrors,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
      return;
    }

    // Handle unexpected errors
    logger.error('Unexpected validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      method: req.method,
      location,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred during validation',
        timestamp: new Date().toISOString(),
        path: req.path,
      },
    });
  }
}

/**
 * Response validation middleware for development/testing
 * Validates API responses against expected schemas
 */
export class ResponseValidationMiddleware {
  static validateResponse(schema: ZodSchema, statusCode: number = 200) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalSend = res.send;
      const originalJson = res.json;

      // Override res.json to validate response
      res.json = function (body: any) {
        if (res.statusCode === statusCode && process.env.NODE_ENV !== 'production') {
          try {
            schema.parse(body);
          } catch (error) {
            logger.error('Response validation failed', {
              path: req.path,
              method: req.method,
              statusCode: res.statusCode,
              error: error instanceof ZodError ? error.errors : error,
              response: body,
            });
          }
        }
        return originalJson.call(this, body);
      };

      // Override res.send to validate response
      res.send = function (body: any) {
        if (res.statusCode === statusCode && process.env.NODE_ENV !== 'production') {
          try {
            const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
            schema.parse(parsedBody);
          } catch (error) {
            logger.error('Response validation failed', {
              path: req.path,
              method: req.method,
              statusCode: res.statusCode,
              error: error instanceof ZodError ? error.errors : error,
              response: body,
            });
          }
        }
        return originalSend.call(this, body);
      };

      next();
    };
  }
}

// Export convenience functions
export const validateBody = SwaggerValidationMiddleware.validateBody;
export const validateQuery = SwaggerValidationMiddleware.validateQuery;
export const validateParams = SwaggerValidationMiddleware.validateParams;
export const validateHeaders = SwaggerValidationMiddleware.validateHeaders;
export const validateRequest = SwaggerValidationMiddleware.validateRequest;
export const validateResponse = ResponseValidationMiddleware.validateResponse;