import { Request, Response } from 'express';
import { AuthService } from '@/services/auth.service';
import { logger } from '@/utils/logger';
import { AuthUtils } from '@/utils/auth';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Register a new user
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Registration error:', error);
      
      const message = error instanceof Error ? error.message : 'Registration failed';
      const statusCode = message.includes('already exists') ? 409 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 409 ? 'USER_EXISTS' : 'REGISTRATION_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Login user
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Login error:', error);
      
      const message = error instanceof Error ? error.message : 'Login failed';
      const statusCode = message.includes('Invalid') || message.includes('deactivated') ? 401 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 401 ? 'INVALID_CREDENTIALS' : 'LOGIN_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const result = await this.authService.refreshToken(refreshToken);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Logout user
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const authHeader = req.headers.authorization;
      const accessToken = AuthUtils.extractTokenFromHeader(authHeader);
      
      if (userId && accessToken) {
        await this.authService.logout(userId, accessToken);
      }
      
      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (error) {
      logger.error('Logout error:', error);
      
      // Always return success for logout
      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    }
  };

  /**
   * Verify email
   */
  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.verifyEmail(req.body);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Email verification error:', error);
      
      const message = error instanceof Error ? error.message : 'Email verification failed';
      const statusCode = message.includes('Invalid') || message.includes('expired') ? 400 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: 'EMAIL_VERIFICATION_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Request password reset
   */
  requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.requestPasswordReset(req.body);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Password reset request error:', error);
      
      const message = error instanceof Error ? error.message : 'Password reset request failed';
      
      res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORD_RESET_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Confirm password reset
   */
  confirmPasswordReset = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.authService.confirmPasswordReset(req.body);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Password reset confirmation error:', error);
      
      const message = error instanceof Error ? error.message : 'Password reset failed';
      const statusCode = message.includes('Invalid') || message.includes('expired') ? 400 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: 'PASSWORD_RESET_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get current user
   */
  getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const user = await this.authService.getCurrentUser(userId);
      
      // Remove password from response
      const { password, ...userResponse } = user;
      
      res.status(200).json({
        success: true,
        data: { user: userResponse },
      });
    } catch (error) {
      logger.error('Get current user error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to get user';
      const statusCode = message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'GET_USER_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };
}