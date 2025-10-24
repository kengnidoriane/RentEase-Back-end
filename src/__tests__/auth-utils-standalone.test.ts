import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// AuthUtils implementation for testing
class AuthUtils {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateAccessToken(payload: any): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: process.env.JWT_EXPIRES_IN as any,
    });
  }

  static generateRefreshToken(payload: any): string {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as any,
    });
  }

  static verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  static verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET!);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateAvatarUrl(firstName: string): string {
    const letter = firstName.charAt(0).toUpperCase();
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const colorIndex = letter.charCodeAt(0) % colors.length;
    const color = colors[colorIndex]?.replace('#', '') || 'FF6B6B';
    
    return `https://ui-avatars.com/api/?name=${letter}&background=${color}&color=fff&size=200&bold=true`;
  }

  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

describe('AuthUtils Standalone Tests', () => {
  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'password123';
      const hashedPassword = await AuthUtils.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });
  });

  describe('comparePassword', () => {
    it('should compare password with hash using bcrypt', async () => {
      const password = 'password123';
      const hashedPassword = await AuthUtils.hashPassword(password);
      
      const isValid = await AuthUtils.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const password = 'password123';
      const wrongPassword = 'wrongPassword';
      const hashedPassword = await AuthUtils.hashPassword(password);
      
      const isValid = await AuthUtils.comparePassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    const payload = {
      userId: 'user-123',
      email: 'test@example.com',
      userType: 'TENANT',
    };

    it('should generate and verify access token', () => {
      const token = AuthUtils.generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = AuthUtils.verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.userType).toBe(payload.userType);
    });

    it('should generate and verify refresh token', () => {
      const token = AuthUtils.generateRefreshToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = AuthUtils.verifyRefreshToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.userType).toBe(payload.userType);
    });

    it('should throw error for invalid access token', () => {
      expect(() => AuthUtils.verifyAccessToken('invalid-token')).toThrow('Invalid or expired access token');
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => AuthUtils.verifyRefreshToken('invalid-token')).toThrow('Invalid or expired refresh token');
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a secure random token', () => {
      const token1 = AuthUtils.generateSecureToken();
      const token2 = AuthUtils.generateSecureToken();

      expect(token1).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2); // Should be different each time
      expect(token1).toMatch(/^[a-f0-9]{64}$/); // Should be hex string
    });
  });

  describe('generateAvatarUrl', () => {
    it('should generate avatar URL with first letter', () => {
      const firstName = 'John';
      const result = AuthUtils.generateAvatarUrl(firstName);

      expect(result).toContain('https://ui-avatars.com/api/');
      expect(result).toContain('name=J');
      expect(result).toContain('background=');
      expect(result).toContain('color=fff');
      expect(result).toContain('size=200');
      expect(result).toContain('bold=true');
    });

    it('should handle lowercase first names', () => {
      const firstName = 'jane';
      const result = AuthUtils.generateAvatarUrl(firstName);

      expect(result).toContain('name=J');
    });

    it('should generate different colors for different letters', () => {
      const urlA = AuthUtils.generateAvatarUrl('Alice');
      const urlB = AuthUtils.generateAvatarUrl('Bob');

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
      const authHeader = 'Bearer valid-token-123';
      const result = AuthUtils.extractTokenFromHeader(authHeader);

      expect(result).toBe('valid-token-123');
    });

    it('should return null for undefined header', () => {
      const result = AuthUtils.extractTokenFromHeader(undefined);
      expect(result).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const authHeader = 'Token valid-token-123';
      const result = AuthUtils.extractTokenFromHeader(authHeader);

      expect(result).toBeNull();
    });

    it('should return empty string for empty Bearer header', () => {
      const authHeader = 'Bearer ';
      const result = AuthUtils.extractTokenFromHeader(authHeader);

      expect(result).toBe('');
    });
  });
});