import { AuthService } from '@/services/auth.service';
import { UserRepository } from '@/repositories/user.repository';
import { RedisService } from '@/services/redis.service';
import { AuthUtils } from '@/utils/auth';
import { emailService } from '@/utils/email';
import { UserType } from '@prisma/client';
import { createUserData, createHashedPassword } from '../factories/userFactory';

// Mock dependencies
jest.mock('@/repositories/user.repository');
jest.mock('@/services/redis.service');
jest.mock('@/utils/auth');
jest.mock('@/utils/email');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create service instance
    authService = new AuthService();

    // Get mocked instances
    mockUserRepository = UserRepository.prototype as jest.Mocked<UserRepository>;
    mockRedisService = RedisService.prototype as jest.Mocked<RedisService>;
  });

  describe('register', () => {
    const registerData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+33123456789',
      userType: 'TENANT' as const,
    };

    it('should register a new user successfully', async () => {
      // Arrange
      const hashedPassword = 'hashedPassword123';
      const avatarUrl = 'https://ui-avatars.com/api/?name=J&background=FF6B6B&color=fff&size=200&bold=true';
      const verificationToken = 'verification-token-123';
      const createdUser = {
        id: 'user-123',
        ...registerData,
        password: hashedPassword,
        profilePicture: avatarUrl,
        userType: UserType.TENANT,
        isVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      (AuthUtils.hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
      (AuthUtils.generateAvatarUrl as jest.Mock).mockReturnValue(avatarUrl);
      (AuthUtils.generateSecureToken as jest.Mock).mockReturnValue(verificationToken);
      mockUserRepository.create.mockResolvedValue(createdUser);
      mockRedisService.storeEmailVerificationToken.mockResolvedValue(undefined);
      (emailService.sendVerificationEmail as jest.Mock).mockResolvedValue(undefined);

      // Act
      const result = await authService.register(registerData);

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(AuthUtils.hashPassword).toHaveBeenCalledWith(registerData.password);
      expect(AuthUtils.generateAvatarUrl).toHaveBeenCalledWith(registerData.firstName);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...registerData,
        password: hashedPassword,
        profilePicture: avatarUrl,
      });
      expect(AuthUtils.generateSecureToken).toHaveBeenCalled();
      expect(mockRedisService.storeEmailVerificationToken).toHaveBeenCalledWith(
        registerData.email,
        verificationToken
      );
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        registerData.email,
        verificationToken,
        registerData.firstName
      );
      expect(result).toEqual({
        message: 'Registration successful. Please check your email to verify your account.',
        userId: createdUser.id,
      });
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const existingUser = createUserData({ email: registerData.email });
      mockUserRepository.findByEmail.mockResolvedValue(existingUser as any);

      // Act & Assert
      await expect(authService.register(registerData)).rejects.toThrow(
        'User with this email already exists'
      );
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should continue registration even if email sending fails', async () => {
      // Arrange
      const hashedPassword = 'hashedPassword123';
      const avatarUrl = 'https://ui-avatars.com/api/?name=J&background=FF6B6B&color=fff&size=200&bold=true';
      const verificationToken = 'verification-token-123';
      const createdUser = {
        id: 'user-123',
        ...registerData,
        password: hashedPassword,
        profilePicture: avatarUrl,
        userType: UserType.TENANT,
        isVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      (AuthUtils.hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
      (AuthUtils.generateAvatarUrl as jest.Mock).mockReturnValue(avatarUrl);
      (AuthUtils.generateSecureToken as jest.Mock).mockReturnValue(verificationToken);
      mockUserRepository.create.mockResolvedValue(createdUser);
      mockRedisService.storeEmailVerificationToken.mockResolvedValue(undefined);
      (emailService.sendVerificationEmail as jest.Mock).mockRejectedValue(new Error('Email service error'));

      // Act
      const result = await authService.register(registerData);

      // Assert
      expect(result).toEqual({
        message: 'Registration successful. Please check your email to verify your account.',
        userId: createdUser.id,
      });
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully', async () => {
      // Arrange
      const hashedPassword = await createHashedPassword(loginData.password);
      const user = {
        id: 'user-123',
        email: loginData.email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        userType: UserType.TENANT,
        isVerified: true,
        isActive: true,
        profilePicture: 'avatar-url',
        phone: '+33123456789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const accessToken = 'access-token-123';
      const refreshToken = 'refresh-token-123';

      mockUserRepository.findByEmail.mockResolvedValue(user);
      (AuthUtils.comparePassword as jest.Mock).mockResolvedValue(true);
      (AuthUtils.generateAccessToken as jest.Mock).mockReturnValue(accessToken);
      (AuthUtils.generateRefreshToken as jest.Mock).mockReturnValue(refreshToken);
      mockRedisService.storeRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(loginData.email);
      expect(AuthUtils.comparePassword).toHaveBeenCalledWith(loginData.password, user.password);
      expect(AuthUtils.generateAccessToken).toHaveBeenCalledWith({
        userId: user.id,
        email: user.email,
        userType: user.userType,
      });
      expect(AuthUtils.generateRefreshToken).toHaveBeenCalledWith({
        userId: user.id,
        email: user.email,
        userType: user.userType,
      });
      expect(mockRedisService.storeRefreshToken).toHaveBeenCalledWith(user.id, refreshToken);
      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: user.userType,
          isVerified: user.isVerified,
          profilePicture: user.profilePicture,
        },
        accessToken,
        refreshToken,
      });
    });

    it('should throw error if user does not exist', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password');
      expect(AuthUtils.comparePassword).not.toHaveBeenCalled();
    });

    it('should throw error if user is inactive', async () => {
      // Arrange
      const user = createUserData({ email: loginData.email, isActive: false });
      mockUserRepository.findByEmail.mockResolvedValue(user as any);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow('Account has been deactivated');
      expect(AuthUtils.comparePassword).not.toHaveBeenCalled();
    });

    it('should throw error if password is invalid', async () => {
      // Arrange
      const user = createUserData({ email: loginData.email });
      mockUserRepository.findByEmail.mockResolvedValue(user as any);
      (AuthUtils.comparePassword as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password');
      expect(AuthUtils.comparePassword).toHaveBeenCalledWith(loginData.password, user.password);
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'refresh-token-123';
    const userId = 'user-123';

    it('should refresh token successfully', async () => {
      // Arrange
      const payload = {
        userId,
        email: 'test@example.com',
        userType: UserType.TENANT,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };
      const user = createUserData({ id: userId });
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      (AuthUtils.verifyRefreshToken as jest.Mock).mockReturnValue(payload);
      mockRedisService.getRefreshToken.mockResolvedValue(refreshToken);
      mockUserRepository.findById.mockResolvedValue(user as any);
      (AuthUtils.generateAccessToken as jest.Mock).mockReturnValue(newAccessToken);
      (AuthUtils.generateRefreshToken as jest.Mock).mockReturnValue(newRefreshToken);
      mockRedisService.storeRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await authService.refreshToken(refreshToken);

      // Assert
      expect(AuthUtils.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockRedisService.getRefreshToken).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(AuthUtils.generateAccessToken).toHaveBeenCalledWith({
        userId: user.id,
        email: user.email,
        userType: user.userType,
      });
      expect(AuthUtils.generateRefreshToken).toHaveBeenCalledWith({
        userId: user.id,
        email: user.email,
        userType: user.userType,
      });
      expect(mockRedisService.storeRefreshToken).toHaveBeenCalledWith(userId, newRefreshToken);
      expect(result).toEqual({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    });

    it('should throw error if refresh token is invalid', async () => {
      // Arrange
      (AuthUtils.verifyRefreshToken as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });

    it('should throw error if refresh token not found in Redis', async () => {
      // Arrange
      const payload = { userId, email: 'test@example.com', userType: UserType.TENANT };
      (AuthUtils.verifyRefreshToken as jest.Mock).mockReturnValue(payload);
      mockRedisService.getRefreshToken.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });

    it('should throw error if stored token does not match', async () => {
      // Arrange
      const payload = { userId, email: 'test@example.com', userType: UserType.TENANT };
      (AuthUtils.verifyRefreshToken as jest.Mock).mockReturnValue(payload);
      mockRedisService.getRefreshToken.mockResolvedValue('different-token');

      // Act & Assert
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });

    it('should throw error if user not found or inactive', async () => {
      // Arrange
      const payload = { userId, email: 'test@example.com', userType: UserType.TENANT };
      (AuthUtils.verifyRefreshToken as jest.Mock).mockReturnValue(payload);
      mockRedisService.getRefreshToken.mockResolvedValue(refreshToken);
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });
  });

  describe('logout', () => {
    const userId = 'user-123';
    const accessToken = 'access-token-123';

    it('should logout user successfully', async () => {
      // Arrange
      const payload = {
        userId,
        email: 'test@example.com',
        userType: UserType.TENANT,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
      };

      mockRedisService.deleteRefreshToken.mockResolvedValue(undefined);
      (AuthUtils.verifyAccessToken as jest.Mock).mockReturnValue(payload);
      mockRedisService.blacklistAccessToken.mockResolvedValue(undefined);

      // Act
      await authService.logout(userId, accessToken);

      // Assert
      expect(mockRedisService.deleteRefreshToken).toHaveBeenCalledWith(userId);
      expect(AuthUtils.verifyAccessToken).toHaveBeenCalledWith(accessToken);
      expect(mockRedisService.blacklistAccessToken).toHaveBeenCalledWith(accessToken, 900);
    });

    it('should not throw error if logout fails', async () => {
      // Arrange
      mockRedisService.deleteRefreshToken.mockRejectedValue(new Error('Redis error'));

      // Act & Assert
      await expect(authService.logout(userId, accessToken)).resolves.not.toThrow();
    });
  });

  describe('verifyEmail', () => {
    const token = 'verification-token-123';
    const email = 'test@example.com';

    it('should verify email successfully', async () => {
      // Arrange
      const user = createUserData({ email, isVerified: false });
      mockRedisService.getEmailFromVerificationToken.mockResolvedValue(email);
      mockUserRepository.findByEmail.mockResolvedValue(user as any);
      mockUserRepository.updateVerificationStatus.mockResolvedValue(undefined);

      // Act
      const result = await authService.verifyEmail({ token });

      // Assert
      expect(mockRedisService.getEmailFromVerificationToken).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(mockUserRepository.updateVerificationStatus).toHaveBeenCalledWith(user.id, true);
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    it('should throw error if token is invalid', async () => {
      // Arrange
      mockRedisService.getEmailFromVerificationToken.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.verifyEmail({ token })).rejects.toThrow(
        'Invalid or expired verification token'
      );
    });

    it('should throw error if user not found', async () => {
      // Arrange
      mockRedisService.getEmailFromVerificationToken.mockResolvedValue(email);
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.verifyEmail({ token })).rejects.toThrow('User not found');
    });

    it('should throw error if email is already verified', async () => {
      // Arrange
      const user = createUserData({ email, isVerified: true });
      mockRedisService.getEmailFromVerificationToken.mockResolvedValue(email);
      mockUserRepository.findByEmail.mockResolvedValue(user as any);

      // Act & Assert
      await expect(authService.verifyEmail({ token })).rejects.toThrow('Email is already verified');
    });
  });

  describe('requestPasswordReset', () => {
    const email = 'test@example.com';

    it('should request password reset successfully', async () => {
      // Arrange
      const user = createUserData({ email });
      const resetToken = 'reset-token-123';

      mockUserRepository.findByEmail.mockResolvedValue(user as any);
      (AuthUtils.generateSecureToken as jest.Mock).mockReturnValue(resetToken);
      mockRedisService.storePasswordResetToken.mockResolvedValue(undefined);
      (emailService.sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      // Act
      const result = await authService.requestPasswordReset({ email });

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(AuthUtils.generateSecureToken).toHaveBeenCalled();
      expect(mockRedisService.storePasswordResetToken).toHaveBeenCalledWith(email, resetToken);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        email,
        resetToken,
        user.firstName
      );
      expect(result).toEqual({
        message: 'If the email exists, a password reset link has been sent.',
      });
    });

    it('should return success message even if user does not exist', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act
      const result = await authService.requestPasswordReset({ email });

      // Assert
      expect(result).toEqual({
        message: 'If the email exists, a password reset link has been sent.',
      });
      expect(AuthUtils.generateSecureToken).not.toHaveBeenCalled();
    });

    it('should throw error if user is inactive', async () => {
      // Arrange
      const user = createUserData({ email, isActive: false });
      mockUserRepository.findByEmail.mockResolvedValue(user as any);

      // Act & Assert
      await expect(authService.requestPasswordReset({ email })).rejects.toThrow(
        'Account has been deactivated'
      );
    });

    it('should throw error if email sending fails', async () => {
      // Arrange
      const user = createUserData({ email });
      const resetToken = 'reset-token-123';

      mockUserRepository.findByEmail.mockResolvedValue(user as any);
      (AuthUtils.generateSecureToken as jest.Mock).mockReturnValue(resetToken);
      mockRedisService.storePasswordResetToken.mockResolvedValue(undefined);
      (emailService.sendPasswordResetEmail as jest.Mock).mockRejectedValue(
        new Error('Email service error')
      );

      // Act & Assert
      await expect(authService.requestPasswordReset({ email })).rejects.toThrow(
        'Failed to send password reset email'
      );
    });
  });

  describe('confirmPasswordReset', () => {
    const token = 'reset-token-123';
    const newPassword = 'newPassword123';
    const email = 'test@example.com';

    it('should confirm password reset successfully', async () => {
      // Arrange
      const user = createUserData({ email });
      const hashedPassword = 'hashedNewPassword123';

      mockRedisService.getEmailFromResetToken.mockResolvedValue(email);
      mockUserRepository.findByEmail.mockResolvedValue(user as any);
      (AuthUtils.hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
      mockUserRepository.updatePassword.mockResolvedValue(undefined);
      mockRedisService.deleteRefreshToken.mockResolvedValue(undefined);

      // Act
      const result = await authService.confirmPasswordReset({ token, newPassword });

      // Assert
      expect(mockRedisService.getEmailFromResetToken).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(AuthUtils.hashPassword).toHaveBeenCalledWith(newPassword);
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(user.id, hashedPassword);
      expect(mockRedisService.deleteRefreshToken).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('should throw error if token is invalid', async () => {
      // Arrange
      mockRedisService.getEmailFromResetToken.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.confirmPasswordReset({ token, newPassword })).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });

    it('should throw error if user not found', async () => {
      // Arrange
      mockRedisService.getEmailFromResetToken.mockResolvedValue(email);
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.confirmPasswordReset({ token, newPassword })).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if user is inactive', async () => {
      // Arrange
      const user = createUserData({ email, isActive: false });
      mockRedisService.getEmailFromResetToken.mockResolvedValue(email);
      mockUserRepository.findByEmail.mockResolvedValue(user as any);

      // Act & Assert
      await expect(authService.confirmPasswordReset({ token, newPassword })).rejects.toThrow(
        'Account has been deactivated'
      );
    });
  });

  describe('getCurrentUser', () => {
    const userId = 'user-123';

    it('should get current user successfully', async () => {
      // Arrange
      const user = createUserData({ id: userId });
      mockUserRepository.findById.mockResolvedValue(user as any);

      // Act
      const result = await authService.getCurrentUser(userId);

      // Assert
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(user);
    });

    it('should throw error if user not found', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.getCurrentUser(userId)).rejects.toThrow('User not found');
    });

    it('should throw error if user is inactive', async () => {
      // Arrange
      const user = createUserData({ id: userId, isActive: false });
      mockUserRepository.findById.mockResolvedValue(user as any);

      // Act & Assert
      await expect(authService.getCurrentUser(userId)).rejects.toThrow('Account has been deactivated');
    });
  });
});