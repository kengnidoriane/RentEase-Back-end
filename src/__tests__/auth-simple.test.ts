import { AuthUtils } from '@/utils/auth';
import { AuthService } from '@/services/auth.service';

describe('Authentication System Unit Tests', () => {
  describe('AuthUtils', () => {
    it('should hash and compare passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await AuthUtils.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      
      const isValid = await AuthUtils.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await AuthUtils.comparePassword('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    it('should generate JWT tokens correctly', () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        userType: 'TENANT'
      };

      const accessToken = AuthUtils.generateAccessToken(payload);
      const refreshToken = AuthUtils.generateRefreshToken(payload);
      
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');
    });

    it('should verify JWT tokens correctly', () => {
      const payload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        userType: 'TENANT'
      };

      const accessToken = AuthUtils.generateAccessToken(payload);
      const verifiedPayload = AuthUtils.verifyAccessToken(accessToken);
      
      expect(verifiedPayload.userId).toBe(payload.userId);
      expect(verifiedPayload.email).toBe(payload.email);
      expect(verifiedPayload.userType).toBe(payload.userType);
    });

    it('should generate secure tokens', () => {
      const token1 = AuthUtils.generateSecureToken();
      const token2 = AuthUtils.generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes * 2 (hex)
    });

    it('should generate avatar URLs correctly', () => {
      const firstName = 'John';
      const avatarUrl = AuthUtils.generateAvatarUrl(firstName);
      
      expect(avatarUrl).toBeDefined();
      expect(avatarUrl).toContain('ui-avatars.com');
      expect(avatarUrl).toContain('name=J');
    });

    it('should extract tokens from headers correctly', () => {
      const token = 'test-token-123';
      const authHeader = `Bearer ${token}`;
      
      const extractedToken = AuthUtils.extractTokenFromHeader(authHeader);
      expect(extractedToken).toBe(token);
      
      const invalidHeader = 'Invalid header';
      const nullToken = AuthUtils.extractTokenFromHeader(invalidHeader);
      expect(nullToken).toBeNull();
      
      const undefinedToken = AuthUtils.extractTokenFromHeader(undefined);
      expect(undefinedToken).toBeNull();
    });
  });

  describe('AuthService', () => {
    it('should be instantiable', () => {
      const authService = new AuthService();
      expect(authService).toBeDefined();
      expect(authService).toBeInstanceOf(AuthService);
    });
  });
});