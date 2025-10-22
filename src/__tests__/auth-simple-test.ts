import { AuthUtils } from '../utils/auth';

describe('Authentication Utils - Simple Test', () => {
  describe('Password hashing', () => {
    it('should hash and verify password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await AuthUtils.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      
      const isValid = await AuthUtils.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await AuthUtils.comparePassword('wrong', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    const mockPayload = {
      userId: 'test-user-id',
      email: 'test@example.com',
      userType: 'TENANT',
    };

    it('should generate and verify tokens', () => {
      const accessToken = AuthUtils.generateAccessToken(mockPayload);
      const refreshToken = AuthUtils.generateRefreshToken(mockPayload);
      
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      
      const decodedAccess = AuthUtils.verifyAccessToken(accessToken);
      const decodedRefresh = AuthUtils.verifyRefreshToken(refreshToken);
      
      expect(decodedAccess.userId).toBe(mockPayload.userId);
      expect(decodedRefresh.userId).toBe(mockPayload.userId);
    });
  });

  describe('Avatar generation', () => {
    it('should generate avatar URL', () => {
      const avatarUrl = AuthUtils.generateAvatarUrl('John');
      
      expect(avatarUrl).toBeDefined();
      expect(avatarUrl).toContain('ui-avatars.com');
      expect(avatarUrl).toContain('name=J');
    });
  });
});