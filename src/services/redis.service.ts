import { redisClient } from '@/config/redis';
import { logger } from '@/utils/logger';

export class RedisService {
  /**
   * Store email verification token
   */
  async storeEmailVerificationToken(email: string, token: string): Promise<void> {
    const key = `email_verification:${token}`;
    const expirationTime = 24 * 60 * 60; // 24 hours in seconds
    
    try {
      await redisClient.setEx(key, expirationTime, email);
      logger.info(`Email verification token stored for ${email}`);
    } catch (error) {
      logger.error('Failed to store email verification token:', error);
      throw new Error('Failed to store verification token');
    }
  }

  /**
   * Get email from verification token
   */
  async getEmailFromVerificationToken(token: string): Promise<string | null> {
    const key = `email_verification:${token}`;
    
    try {
      const email = await redisClient.get(key);
      if (email) {
        // Delete the token after use
        await redisClient.del(key);
      }
      return email;
    } catch (error) {
      logger.error('Failed to get email from verification token:', error);
      return null;
    }
  }

  /**
   * Store password reset token
   */
  async storePasswordResetToken(email: string, token: string): Promise<void> {
    const key = `password_reset:${token}`;
    const expirationTime = 60 * 60; // 1 hour in seconds
    
    try {
      await redisClient.setEx(key, expirationTime, email);
      logger.info(`Password reset token stored for ${email}`);
    } catch (error) {
      logger.error('Failed to store password reset token:', error);
      throw new Error('Failed to store reset token');
    }
  }

  /**
   * Get email from password reset token
   */
  async getEmailFromResetToken(token: string): Promise<string | null> {
    const key = `password_reset:${token}`;
    
    try {
      const email = await redisClient.get(key);
      if (email) {
        // Delete the token after use
        await redisClient.del(key);
      }
      return email;
    } catch (error) {
      logger.error('Failed to get email from reset token:', error);
      return null;
    }
  }

  /**
   * Store refresh token
   */
  async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    const expirationTime = 7 * 24 * 60 * 60; // 7 days in seconds
    
    try {
      await redisClient.setEx(key, expirationTime, refreshToken);
      logger.info(`Refresh token stored for user ${userId}`);
    } catch (error) {
      logger.error('Failed to store refresh token:', error);
      throw new Error('Failed to store refresh token');
    }
  }

  /**
   * Get refresh token for user
   */
  async getRefreshToken(userId: string): Promise<string | null> {
    const key = `refresh_token:${userId}`;
    
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Delete refresh token
   */
  async deleteRefreshToken(userId: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    
    try {
      await redisClient.del(key);
      logger.info(`Refresh token deleted for user ${userId}`);
    } catch (error) {
      logger.error('Failed to delete refresh token:', error);
    }
  }

  /**
   * Blacklist access token (for logout)
   */
  async blacklistAccessToken(token: string, expirationTime: number): Promise<void> {
    const key = `blacklisted_token:${token}`;
    
    try {
      await redisClient.setEx(key, expirationTime, 'blacklisted');
      logger.info('Access token blacklisted');
    } catch (error) {
      logger.error('Failed to blacklist access token:', error);
    }
  }

  /**
   * Check if access token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = `blacklisted_token:${token}`;
    
    try {
      const result = await redisClient.get(key);
      return result === 'blacklisted';
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false;
    }
  }
}