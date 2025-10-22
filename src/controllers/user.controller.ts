import { Request, Response } from 'express';
import { UserService } from '@/services/user.service';
import { logger } from '@/utils/logger';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get user profile
   */
  getProfile = async (req: Request, res: Response): Promise<void> => {
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

      const profile = await this.userService.getProfile(userId);
      
      res.status(200).json({
        success: true,
        data: { profile },
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to get profile';
      const statusCode = message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'GET_PROFILE_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Update user profile
   */
  updateProfile = async (req: Request, res: Response): Promise<void> => {
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

      const updatedProfile = await this.userService.updateProfile(userId, req.body);
      
      res.status(200).json({
        success: true,
        data: { profile: updatedProfile },
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to update profile';
      const statusCode = message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'UPDATE_PROFILE_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Upload profile picture
   */
  uploadProfilePicture = async (req: Request, res: Response): Promise<void> => {
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

      if (!req.processedImage) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No profile picture uploaded',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      // In a real application, you would upload the file to S3 or similar service
      // For now, we'll simulate a URL
      const profilePictureUrl = `https://example.com/uploads/${req.processedImage.filename}`;
      
      const updatedProfile = await this.userService.updateProfilePicture(userId, profilePictureUrl);
      
      res.status(200).json({
        success: true,
        data: { 
          profile: updatedProfile,
          message: 'Profile picture updated successfully'
        },
      });
    } catch (error) {
      logger.error('Upload profile picture error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to upload profile picture';
      const statusCode = message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'UPLOAD_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Generate new avatar
   */
  generateAvatar = async (req: Request, res: Response): Promise<void> => {
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

      const updatedProfile = await this.userService.generateNewAvatar(userId);
      
      res.status(200).json({
        success: true,
        data: { 
          profile: updatedProfile,
          message: 'New avatar generated successfully'
        },
      });
    } catch (error) {
      logger.error('Generate avatar error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to generate avatar';
      const statusCode = message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'AVATAR_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Change password
   */
  changePassword = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.userService.changePassword(userId, req.body);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Change password error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to change password';
      const statusCode = message.includes('incorrect') ? 400 : 
                        message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'PASSWORD_CHANGE_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Upload verification document
   */
  uploadVerificationDocument = async (req: Request, res: Response): Promise<void> => {
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

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No document uploaded',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const { documentType } = req.body;
      
      // In a real application, you would upload the file to S3 or similar service
      // For now, we'll simulate a URL
      const documentUrl = `https://example.com/documents/${Date.now()}-${req.file.originalname}`;
      
      const document = await this.userService.uploadVerificationDocument(userId, documentType, documentUrl);
      
      res.status(201).json({
        success: true,
        data: { 
          document,
          message: 'Verification document uploaded successfully'
        },
      });
    } catch (error) {
      logger.error('Upload verification document error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to upload document';
      const statusCode = message.includes('not found') ? 404 : 
                        message.includes('Only landlords') ? 403 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 
                statusCode === 403 ? 'FORBIDDEN' : 'UPLOAD_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get verification documents
   */
  getVerificationDocuments = async (req: Request, res: Response): Promise<void> => {
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

      const documents = await this.userService.getVerificationDocuments(userId);
      
      res.status(200).json({
        success: true,
        data: { documents },
      });
    } catch (error) {
      logger.error('Get verification documents error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to get documents';
      const statusCode = message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'GET_DOCUMENTS_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get verification status
   */
  getVerificationStatus = async (req: Request, res: Response): Promise<void> => {
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

      const status = await this.userService.getVerificationStatus(userId);
      
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Get verification status error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to get verification status';
      const statusCode = message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'GET_STATUS_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Delete user account
   */
  deleteAccount = async (req: Request, res: Response): Promise<void> => {
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

      const result = await this.userService.deleteAccount(userId);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Delete account error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      const statusCode = message.includes('not found') ? 404 : 400;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'USER_NOT_FOUND' : 'DELETE_ACCOUNT_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };
}