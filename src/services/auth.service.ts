import { User } from '@prisma/client';
import { UserRepository } from '@/repositories/user.repository';
import { RedisService } from '@/services/redis.service';
import { AuthUtils } from '@/utils/auth';
import { emailService } from '@/utils/email';
import { logger } from '@/utils/logger';
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  PasswordResetRequest,
  PasswordResetConfirm,
  EmailVerificationRequest,
} from '@/types/auth.types';

export class AuthService {
  private userRepository: UserRepository;
  private redisService: RedisService;

  constructor() {
    this.userRepository = new UserRepository();
    this.redisService = new RedisService();
  }

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<{ message: string; userId: string }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await AuthUtils.hashPassword(data.password);

    // Generate avatar URL if no profile picture provided
    const profilePicture = AuthUtils.generateAvatarUrl(data.firstName);

    // Create user
    const user = await this.userRepository.create({
      ...data,
      password: hashedPassword,
      profilePicture,
    });

    // Generate verification token and send email
    const verificationToken = AuthUtils.generateSecureToken();
    await this.redisService.storeEmailVerificationToken(user.email, verificationToken);
    
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken, user.firstName);
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      // Don't throw error here, user is created successfully
    }

    logger.info(`User registered successfully: ${user.email}`);
    
    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    // Find user by email
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    // Verify password
    const isPasswordValid = await AuthUtils.comparePassword(data.password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      userType: user.userType,
    };

    const accessToken = AuthUtils.generateAccessToken(tokenPayload);
    const refreshToken = AuthUtils.generateRefreshToken(tokenPayload);

    // Store refresh token in Redis
    await this.redisService.storeRefreshToken(user.id, refreshToken);

    logger.info(`User logged in successfully: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        isVerified: user.isVerified,
        ...(user.profilePicture && { profilePicture: user.profilePicture }),
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const payload = AuthUtils.verifyRefreshToken(refreshToken);
      
      // Check if refresh token exists in Redis
      const storedToken = await this.redisService.getRefreshToken(payload.userId);
      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get user to ensure they still exist and are active
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        userType: user.userType,
      };

      const newAccessToken = AuthUtils.generateAccessToken(tokenPayload);
      const newRefreshToken = AuthUtils.generateRefreshToken(tokenPayload);

      // Store new refresh token
      await this.redisService.storeRefreshToken(user.id, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string, accessToken: string): Promise<void> {
    try {
      // Delete refresh token from Redis
      await this.redisService.deleteRefreshToken(userId);
      
      // Blacklist the access token
      const payload = AuthUtils.verifyAccessToken(accessToken);
      const expirationTime = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 900; // Default 15 minutes
      
      if (expirationTime > 0) {
        await this.redisService.blacklistAccessToken(accessToken, expirationTime);
      }

      logger.info(`User logged out successfully: ${userId}`);
    } catch (error) {
      logger.error('Error during logout:', error);
      // Don't throw error, logout should always succeed
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(data: EmailVerificationRequest): Promise<{ message: string }> {
    // Get email from verification token
    const email = await this.redisService.getEmailFromVerificationToken(data.token);
    if (!email) {
      throw new Error('Invalid or expired verification token');
    }

    // Find user and update verification status
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isVerified) {
      throw new Error('Email is already verified');
    }

    await this.userRepository.updateVerificationStatus(user.id, true);

    logger.info(`Email verified successfully: ${email}`);

    return { message: 'Email verified successfully' };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<{ message: string }> {
    // Find user by email
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      // Don't reveal if email exists or not
      return { message: 'If the email exists, a password reset link has been sent.' };
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    // Generate reset token and send email
    const resetToken = AuthUtils.generateSecureToken();
    await this.redisService.storePasswordResetToken(user.email, resetToken);
    
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }

    logger.info(`Password reset requested for: ${user.email}`);

    return { message: 'If the email exists, a password reset link has been sent.' };
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(data: PasswordResetConfirm): Promise<{ message: string }> {
    // Get email from reset token
    const email = await this.redisService.getEmailFromResetToken(data.token);
    if (!email) {
      throw new Error('Invalid or expired reset token');
    }

    // Find user and update password
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    // Hash new password and update
    const hashedPassword = await AuthUtils.hashPassword(data.newPassword);
    await this.userRepository.updatePassword(user.id, hashedPassword);

    // Invalidate all existing refresh tokens for this user
    await this.redisService.deleteRefreshToken(user.id);

    logger.info(`Password reset successfully for: ${email}`);

    return { message: 'Password reset successfully' };
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated');
    }

    return user;
  }
}