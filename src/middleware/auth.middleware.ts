import { Request, Response, NextFunction } from 'express';
import { AuthUtils } from '@/utils/auth';
import { RedisService } from '@/services/redis.service';
import { UserRepository } from '@/repositories/user.repository';
import { JwtPayload } from '@/types/auth.types';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { id: string };
    }
  }
}

export class AuthMiddleware {
  private redisService: RedisService;
  private userRepository: UserRepository;

  constructor() {
    this.redisService = new RedisService();
    this.userRepository = new UserRepository();
  }

  /**
   * Authenticate user with JWT token
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = AuthUtils.extractTokenFromHeader(authHeader);

      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Access token is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.redisService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token has been invalidated',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      // Verify token
      const payload = AuthUtils.verifyAccessToken(token);

      // Verify user still exists and is active
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not found or inactive',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      // Add user to request object
      req.user = {
        ...payload,
        id: payload.userId,
      };

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Authorize user based on roles
   */
  authorize = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      if (!allowedRoles.includes(req.user.userType)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
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
   * Require email verification
   */
  requireEmailVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const user = await this.userRepository.findById(req.user.userId);
      if (!user || !user.isVerified) {
        res.status(403).json({
          success: false,
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Email verification required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify email status',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Optional authentication (doesn't fail if no token provided)
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = AuthUtils.extractTokenFromHeader(authHeader);

      if (!token) {
        next();
        return;
      }

      // Check if token is blacklisted
      const isBlacklisted = await this.redisService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        next();
        return;
      }

      // Verify token
      const payload = AuthUtils.verifyAccessToken(token);

      // Verify user still exists and is active
      const user = await this.userRepository.findById(payload.userId);
      if (user && user.isActive) {
        req.user = {
          ...payload,
          id: payload.userId,
        };
      }

      next();
    } catch (error) {
      // Ignore errors in optional auth
      next();
    }
  };
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

export const authenticate = authMiddleware.authenticate;
export const authorize = authMiddleware.authorize;
export const requireEmailVerification = authMiddleware.requireEmailVerification;
export const optionalAuth = authMiddleware.optionalAuth;