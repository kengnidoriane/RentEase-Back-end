import { AuthUtils } from '@/utils/auth';

describe('Authentication Utils', () => {
  describe('Password hashing', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await AuthUtils.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('should verify a correct password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await AuthUtils.hashPassword(password);
      
      const isValid = await AuthUtils.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await AuthUtils.hashPassword(password);
      
      const isValid = await AuthUtils.comparePassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    const mockPayload = {
      userId: 'test-user-id',
      email: 'test@example.com',
      userType: 'TENANT',
    };

    it('should generate and verify access token', () => {
      const token = AuthUtils.generateAccessToken(mockPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = AuthUtils.verifyAccessToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.userType).toBe(mockPayload.userType);
    });

    it('should generate and verify refresh token', () => {
      const token = AuthUtils.generateRefreshToken(mockPayload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = AuthUtils.verifyRefreshToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.userType).toBe(mockPayload.userType);
    });

    it('should throw error for invalid access token', () => {
      expect(() => {
        AuthUtils.verifyAccessToken('invalid-token');
      }).toThrow('Invalid or expired access token');
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        AuthUtils.verifyRefreshToken('invalid-token');
      }).toThrow('Invalid or expired refresh token');
    });
  });

  describe('Avatar generation', () => {
    it('should generate avatar URL with first letter', () => {
      const firstName = 'John';
      const avatarUrl = AuthUtils.generateAvatarUrl(firstName);
      
      expect(avatarUrl).toBeDefined();
      expect(avatarUrl).toContain('ui-avatars.com');
      expect(avatarUrl).toContain('name=J');
      expect(avatarUrl).toContain('size=200');
    });

    it('should handle empty first name', () => {
      const firstName = '';
      const avatarUrl = AuthUtils.generateAvatarUrl(firstName);
      
      expect(avatarUrl).toBeDefined();
      expect(avatarUrl).toContain('ui-avatars.com');
    });
  });

  describe('Token extraction', () => {
    it('should extract token from Bearer header', () => {
      const token = 'test-token-123';
      const authHeader = `Bearer ${token}`;
      
      const extractedToken = AuthUtils.extractTokenFromHeader(authHeader);
      expect(extractedToken).toBe(token);
    });

    it('should return null for invalid header format', () => {
      const authHeader = 'Invalid header';
      
      const extractedToken = AuthUtils.extractTokenFromHeader(authHeader);
      expect(extractedToken).toBeNull();
    });

    it('should return null for undefined header', () => {
      const extractedToken = AuthUtils.extractTokenFromHeader(undefined);
      expect(extractedToken).toBeNull();
    });
  });
});