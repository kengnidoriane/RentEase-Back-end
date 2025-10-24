import request from 'supertest';
import express, { Express } from 'express';
import { AuthController } from '@/controllers/auth.controller';
import { validateRequest } from '@/middleware/validation.middleware';
import { authenticate } from '@/middleware/auth.middleware';
import { createUserData, createHashedPassword } from '../factories/userFactory';
import { UserType } from '@prisma/client';
import { AuthUtils } from '@/utils/auth';
import { RedisService } from '@/services/redis.service';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  emailVerificationSchema,
} from '@/utils/validation';

// Mock external services
jest.mock('@/utils/email', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Prisma for integration tests
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
  UserType: {
    TENANT: 'TENANT',
    LANDLORD: 'LANDLORD',
    ADMIN: 'ADMIN',
  },
}));

describe('Auth Integration Tests', () => {
  let app: Express;
  let redisService: RedisService;

  beforeAll(async () => {
    // Create Express app with auth routes
    app = express();
    app.use(express.json());
    
    const authController = new AuthController();
    
    // Add auth routes
    app.post('/api/auth/register', validateRequest(registerSchema), authController.register);
    app.post('/api/auth/login', validateRequest(loginSchema), authController.login);
    app.post('/api/auth/refresh', validateRequest(refreshTokenSchema), authController.refreshToken);
    app.post('/api/auth/logout', authenticate, authController.logout);
    app.post('/api/auth/verify-email', validateRequest(emailVerificationSchema), authController.verifyEmail);
    app.post('/api/auth/forgot-password', validateRequest(passwordResetRequestSchema), authController.requestPasswordReset);
    app.post('/api/auth/reset-password', validateRequest(passwordResetConfirmSchema), authController.confirmPasswordReset);
    app.get('/api/auth/me', authenticate, authController.getCurrentUser);
    
    redisService = new RedisService();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset mock implementations
    Object.values(mockPrisma.user).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockReset();
      }
    });
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+33123456789',
      userType: 'TENANT',
    };

    it('should register a new user successfully', async () => {
      // Arrange
      const createdUser = {
        id: 'user-123',
        ...validRegistrationData,
        userType: UserType.TENANT,
        isVerified: false,
        isActive: true,
        profilePicture: 'https://ui-avatars.com/api/?name=J&background=FF6B6B&color=fff&size=200&bold=true',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.user.findUnique.mockResolvedValue(null); // User doesn't exist
      mockPrisma.user.create.mockResolvedValue(createdUser);

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Registration successful. Please check your email to verify your account.',
          userId: expect.any(String),
        },
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: validRegistrationData.email },
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should return 409 if user already exists', async () => {
      // Arrange
      const existingUser = createUserData({ email: validRegistrationData.email });
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(409);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
          timestamp: expect.any(String),
          path: '/api/auth/register',
        },
      });
    });

    it('should return 400 for invalid data', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // Too short
          firstName: '',
          lastName: '',
          phone: '',
          userType: 'INVALID',
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    const password = 'password123';
    let user: any;

    beforeEach(async () => {
      const hashedPassword = await createHashedPassword(password);
      user = createUserData({
        email: 'test@example.com',
        password: hashedPassword,
        isVerified: true,
      });
    });

    it('should login user successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password,
        })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userType: user.userType,
            isVerified: user.isVerified,
          },
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      // Verify tokens are valid
      const accessTokenPayload = AuthUtils.verifyAccessToken(response.body.data.accessToken);
      expect(accessTokenPayload.userId).toBe(user.id);
      expect(accessTokenPayload.email).toBe(user.email);

      const refreshTokenPayload = AuthUtils.verifyRefreshToken(response.body.data.refreshToken);
      expect(refreshTokenPayload.userId).toBe(user.id);
    });

    it('should return 401 for invalid email', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password,
        })
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp: expect.any(String),
          path: '/api/auth/login',
        },
      });
    });

    it('should return 401 for invalid password', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'wrongpassword',
        })
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          timestamp: expect.any(String),
          path: '/api/auth/login',
        },
      });
    });

    it('should return 401 for inactive user', async () => {
      // Arrange
      const inactiveUser = { ...user, isActive: false };
      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password,
        })
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Account has been deactivated',
          timestamp: expect.any(String),
          path: '/api/auth/login',
        },
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    let user: any;
    let refreshToken: string;

    beforeEach(async () => {
      user = createUserData({
        email: 'test@example.com',
        isVerified: true,
      });

      // Generate refresh token
      refreshToken = AuthUtils.generateRefreshToken({
        userId: user.id,
        email: user.email,
        userType: user.userType,
      });
    });

    it('should refresh token successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      // Verify new tokens are valid
      const accessTokenPayload = AuthUtils.verifyAccessToken(response.body.data.accessToken);
      expect(accessTokenPayload.userId).toBe(user.id);

      const newRefreshTokenPayload = AuthUtils.verifyRefreshToken(response.body.data.refreshToken);
      expect(newRefreshTokenPayload.userId).toBe(user.id);
    });

    it('should return 401 for invalid refresh token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
          timestamp: expect.any(String),
          path: '/api/auth/refresh',
        },
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    let user: any;
    let accessToken: string;

    beforeEach(async () => {
      user = createUserData({
        email: 'test@example.com',
        isVerified: true,
      });

      // Generate access token
      accessToken = AuthUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        userType: user.userType,
      });
    });

    it('should logout user successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    });

    it('should return 401 without authentication', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    let user: any;
    let verificationToken: string;

    beforeEach(async () => {
      user = createUserData({
        email: 'test@example.com',
        isVerified: false,
      });

      verificationToken = AuthUtils.generateSecureToken();
    });

    it('should verify email successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, isVerified: true });

      // Act
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: { message: 'Email verified successfully' },
      });
    });

    it('should return 400 for invalid token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'EMAIL_VERIFICATION_ERROR',
          message: 'Invalid or expired verification token',
          timestamp: expect.any(String),
          path: '/api/auth/verify-email',
        },
      });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    let user: any;

    beforeEach(async () => {
      user = createUserData({ email: 'test@example.com' });
    });

    it('should request password reset successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'If the email exists, a password reset link has been sent.',
        },
      });
    });

    it('should return success even for non-existent email', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'If the email exists, a password reset link has been sent.',
        },
      });
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let user: any;
    let resetToken: string;

    beforeEach(async () => {
      user = createUserData({ email: 'test@example.com' });
      resetToken = AuthUtils.generateSecureToken();
    });

    it('should reset password successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({ ...user, password: 'newHashedPassword' });

      // Act
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newPassword123',
        })
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: { message: 'Password reset successfully' },
      });
    });

    it('should return 400 for invalid token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'newPassword123',
        })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PASSWORD_RESET_ERROR',
          message: 'Invalid or expired reset token',
          timestamp: expect.any(String),
          path: '/api/auth/reset-password',
        },
      });
    });
  });

  describe('GET /api/auth/me', () => {
    let user: any;
    let accessToken: string;

    beforeEach(async () => {
      user = createUserData({ email: 'test@example.com' });

      accessToken = AuthUtils.generateAccessToken({
        userId: user.id,
        email: user.email,
        userType: user.userType,
      });
    });

    it('should get current user successfully', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          user: expect.objectContaining({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            userType: user.userType,
            isVerified: user.isVerified,
            isActive: user.isActive,
          }),
        },
      });
    });

    it('should return 401 without authentication', async () => {
      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for invalid token', async () => {
      // Act
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});