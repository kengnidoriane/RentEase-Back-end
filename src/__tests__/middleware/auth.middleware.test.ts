import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '@/middleware/auth.middleware';
import { AuthUtils } from '@/utils/auth';
import { RedisService } from '@/services/redis.service';
import { UserRepository } from '@/repositories/user.repository';
import { UserType } from '@prisma/client';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/testUtils';
import { createUserData } from '../factories/userFactory';

// Mock dependencies
jest.mock('@/utils/auth');
jest.mock('@/services/redis.service');
jest.mock('@/repositories/user.repository');

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    authMiddleware = new AuthMiddleware();
    mockRedisService = RedisService.prototype as jest.Mocked<RedisService>;
    mockUserRepository = UserRepository.prototype as jest.Mocked<UserRepository>;

    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  describe('authenticate', () => {
    const validToken = 'valid-token-123';
    const validPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      userType: UserType.TENANT,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    };

    it('should authenticate user with valid token', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      const user = createUserData({ id: validPayload.userId });

      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      (AuthUtils.verifyAccessToken as jest.Mock).mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(user as any);

      // Act
      await authMiddleware.authenticate(req as Request, res as Response, next);

      // Assert
      expect(AuthUtils.extractTokenFromHeader).toHaveBeenCalledWith(`Bearer ${validToken}`);
      expect(mockRedisService.isTokenBlacklisted).toHaveBeenCalledWith(validToken);
      expect(AuthUtils.verifyAccessToken).toHaveBeenCalledWith(validToken);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(validPayload.userId);
      expect(req.user).toEqual({
        ...validPayload,
        id: validPayload.userId,
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no token provided', async () => {
      // Arrange
      req.headers = {};
      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(null);

      // Act
      await authMiddleware.authenticate(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token is required',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is blacklisted', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(true);

      // Act
      await authMiddleware.authenticate(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token has been invalidated',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      (AuthUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      await authMiddleware.authenticate(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user not found', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      (AuthUtils.verifyAccessToken as jest.Mock).mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      await authMiddleware.authenticate(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or inactive',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user is inactive', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      const inactiveUser = createUserData({ id: validPayload.userId, isActive: false });

      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      (AuthUtils.verifyAccessToken as jest.Mock).mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(inactiveUser as any);

      // Act
      await authMiddleware.authenticate(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or inactive',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    const allowedRoles = [UserType.ADMIN, UserType.LANDLORD];

    it('should authorize user with allowed role', () => {
      // Arrange
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.ADMIN,
        id: 'user-123',
      };
      const authorizeMiddleware = authMiddleware.authorize(allowedRoles);

      // Act
      authorizeMiddleware(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', () => {
      // Arrange
      delete req.user;
      const authorizeMiddleware = authMiddleware.authorize(allowedRoles);

      // Act
      authorizeMiddleware(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user role not allowed', () => {
      // Arrange
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
        id: 'user-123',
      };
      const authorizeMiddleware = authMiddleware.authorize(allowedRoles);

      // Act
      authorizeMiddleware(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireEmailVerification', () => {
    it('should allow verified user to proceed', async () => {
      // Arrange
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
        id: 'user-123',
      };
      const verifiedUser = createUserData({ id: 'user-123', isVerified: true });
      mockUserRepository.findById.mockResolvedValue(verifiedUser as any);

      // Act
      await authMiddleware.requireEmailVerification(req as Request, res as Response, next);

      // Assert
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', async () => {
      // Arrange
      delete req.user;

      // Act
      await authMiddleware.requireEmailVerification(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user not found', async () => {
      // Arrange
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
        id: 'user-123',
      };
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      await authMiddleware.requireEmailVerification(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification required',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user email not verified', async () => {
      // Arrange
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
        id: 'user-123',
      };
      const unverifiedUser = createUserData({ id: 'user-123', isVerified: false });
      mockUserRepository.findById.mockResolvedValue(unverifiedUser as any);

      // Act
      await authMiddleware.requireEmailVerification(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification required',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 500 if database error occurs', async () => {
      // Arrange
      req.user = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
        id: 'user-123',
      };
      mockUserRepository.findById.mockRejectedValue(new Error('Database error'));

      // Act
      await authMiddleware.requireEmailVerification(req as Request, res as Response, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to verify email status',
          timestamp: expect.any(String),
          path: req.path,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    const validToken = 'valid-token-123';
    const validPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      userType: UserType.TENANT,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    };

    it('should authenticate user with valid token', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      const user = createUserData({ id: validPayload.userId });

      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      (AuthUtils.verifyAccessToken as jest.Mock).mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(user as any);

      // Act
      await authMiddleware.optionalAuth(req as Request, res as Response, next);

      // Assert
      expect(req.user).toEqual({
        ...validPayload,
        id: validPayload.userId,
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication if no token provided', async () => {
      // Arrange
      req.headers = {};
      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(null);

      // Act
      await authMiddleware.optionalAuth(req as Request, res as Response, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication if token is blacklisted', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(true);

      // Act
      await authMiddleware.optionalAuth(req as Request, res as Response, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication if token is invalid', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      (AuthUtils.verifyAccessToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      await authMiddleware.optionalAuth(req as Request, res as Response, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication if user not found', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      (AuthUtils.verifyAccessToken as jest.Mock).mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      await authMiddleware.optionalAuth(req as Request, res as Response, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed without authentication if user is inactive', async () => {
      // Arrange
      req.headers = { authorization: `Bearer ${validToken}` };
      const inactiveUser = createUserData({ id: validPayload.userId, isActive: false });

      (AuthUtils.extractTokenFromHeader as jest.Mock).mockReturnValue(validToken);
      mockRedisService.isTokenBlacklisted.mockResolvedValue(false);
      (AuthUtils.verifyAccessToken as jest.Mock).mockReturnValue(validPayload);
      mockUserRepository.findById.mockResolvedValue(inactiveUser as any);

      // Act
      await authMiddleware.optionalAuth(req as Request, res as Response, next);

      // Assert
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});