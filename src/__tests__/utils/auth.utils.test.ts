import { AuthUtils } from '@/utils/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserType } from '@prisma/client';

// Mock bcrypt and jwt
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set test environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      // Arrange
      const password = 'password123';
      const hashedPassword = 'hashedPassword123';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      // Act
      const result = await AuthUtils.hashPassword(password);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('comparePassword', () => {
    it('should compare password with hash using bcrypt', async () => {
      // Arrange
      const password = 'password123';
      const hash = 'hashedPassword123';
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await AuthUtils.comparePassword(password, hash);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      // Arrange
      const password = 'wrongPassword';
      const hash = 'hashedPassword123';
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await AuthUtils.comparePassword(password, hash);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(false);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate JWT access token', () => {
      // Arrange
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
      };
      const token = 'generated-access-token';
      (jwt.sign as jest.Mock).mockReturnValue(token);

      // Act
      const result = AuthUtils.generateAccessToken(payload);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(payload, 'test-jwt-secret', {
        expiresIn: '15m',
      });
      expect(result).toBe(token);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate JWT refresh token', () => {
      // Arrange
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
      };
      const token = 'generated-refresh-token';
      (jwt.sign as jest.Mock).mockReturnValue(token);

      // Act
      const result = AuthUtils.generateRefreshToken(payload);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(payload, 'test-refresh-secret', {
        expiresIn: '7d',
      });
      expect(result).toBe(token);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and return JWT payload', () => {
      // Arrange
      const token = 'valid-access-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      };
      (jwt.verify as jest.Mock).mockReturnValue(payload);

      // Act
      const result = AuthUtils.verifyAccessToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-jwt-secret');
      expect(result).toEqual(payload);
    });

    it('should throw error for invalid token', () => {
      // Arrange
      const token = 'invalid-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      expect(() => AuthUtils.verifyAccessToken(token)).toThrow('Invalid or expired access token');
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-jwt-secret');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify and return JWT payload', () => {
      // Arrange
      const token = 'valid-refresh-token';
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        userType: UserType.TENANT,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };
      (jwt.verify as jest.Mock).mockReturnValue(payload);

      // Act
      const result = AuthUtils.verifyRefreshToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-refresh-secret');
      expect(result).toEqual(payload);
    });

    it('should throw error for invalid token', () => {
      // Arrange
      const token = 'invalid-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      expect(() => AuthUtils.verifyRefreshToken(token)).toThrow('Invalid or expired refresh token');
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-refresh-secret');
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a secure random token', () => {
      // Act
      const token1 = AuthUtils.generateSecureToken();
      const token2 = AuthUtils.generateSecureToken();

      // Assert
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2); // Should be different each time
      expect(token1).toMatch(/^[a-f0-9]{64}$/); // Should be hex string
    });
  });

  describe('generateAvatarUrl', () => {
    it('should generate avatar URL with first letter', () => {
      // Arrange
      const firstName = 'John';

      // Act
      const result = AuthUtils.generateAvatarUrl(firstName);

      // Assert
      expect(result).toContain('https://ui-avatars.com/api/');
      expect(result).toContain('name=J');
      expect(result).toContain('background=');
      expect(result).toContain('color=fff');
      expect(result).toContain('size=200');
      expect(result).toContain('bold=true');
    });

    it('should handle lowercase first names', () => {
      // Arrange
      const firstName = 'jane';

      // Act
      const result = AuthUtils.generateAvatarUrl(firstName);

      // Assert
      expect(result).toContain('name=J');
    });

    it('should handle empty first names', () => {
      // Arrange
      const firstName = '';

      // Act
      const result = AuthUtils.generateAvatarUrl(firstName);

      // Assert
      expect(result).toContain('name=');
    });

    it('should generate different colors for different letters', () => {
      // Act
      const urlA = AuthUtils.generateAvatarUrl('Alice');
      const urlB = AuthUtils.generateAvatarUrl('Bob');

      // Assert
      expect(urlA).not.toBe(urlB);
      // Extract background colors
      const colorA = urlA.match(/background=([a-fA-F0-9]{6})/)?.[1];
      const colorB = urlB.match(/background=([a-fA-F0-9]{6})/)?.[1];
      expect(colorA).toBeDefined();
      expect(colorB).toBeDefined();
      // Colors should be different for different letters
      expect(colorA).not.toBe(colorB);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      // Arrange
      const authHeader = 'Bearer valid-token-123';

      // Act
      const result = AuthUtils.extractTokenFromHeader(authHeader);

      // Assert
      expect(result).toBe('valid-token-123');
    });

    it('should return null for undefined header', () => {
      // Act
      const result = AuthUtils.extractTokenFromHeader(undefined);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      // Arrange
      const authHeader = 'Token valid-token-123';

      // Act
      const result = AuthUtils.extractTokenFromHeader(authHeader);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for empty Bearer header', () => {
      // Arrange
      const authHeader = 'Bearer ';

      // Act
      const result = AuthUtils.extractTokenFromHeader(authHeader);

      // Assert
      expect(result).toBe('');
    });

    it('should handle Bearer header with extra spaces', () => {
      // Arrange
      const authHeader = 'Bearer  valid-token-123';

      // Act
      const result = AuthUtils.extractTokenFromHeader(authHeader);

      // Assert
      expect(result).toBe(' valid-token-123');
    });
  });
});