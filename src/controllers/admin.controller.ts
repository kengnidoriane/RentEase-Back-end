import { Request, Response } from 'express';
import { UserRepository } from '@/repositories/user.repository';
import { logger } from '@/utils/logger';

export class AdminController {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Get all users (admin only)
   */
  getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      const { users, total } = await this.userRepository.findAll(page, limit);
      
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);

      res.status(200).json({
        success: true,
        data: {
          users: usersWithoutPasswords,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get all users error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get users',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get user by ID (admin only)
   */
  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params['userId'];
      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User ID is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }
      
      const user = await this.userRepository.findWithVerificationDocuments(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      res.status(200).json({
        success: true,
        data: { user: userWithoutPassword },
      });
    } catch (error) {
      logger.error('Get user by ID error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get user',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Update user status (admin only)
   */
  updateUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params['userId'];
      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'User ID is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }
      
      const { isActive } = req.body;

      const user = await this.userRepository.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const updatedUser = await this.userRepository.update(userId, { isActive });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;

      logger.info(`User status updated by admin: ${userId}, isActive: ${isActive}`);

      res.status(200).json({
        success: true,
        data: { 
          user: userWithoutPassword,
          message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
        },
      });
    } catch (error) {
      logger.error('Update user status error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user status',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Review verification document (admin only)
   */
  reviewVerificationDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const documentId = req.params['documentId'];
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Document ID is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }
      
      const { status, rejectionReason } = req.body;

      if (status === 'REJECTED' && !rejectionReason) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Rejection reason is required when rejecting a document',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const updatedDocument = await this.userRepository.updateVerificationDocumentStatus(
        documentId,
        status,
        rejectionReason
      );

      logger.info(`Verification document reviewed by admin: ${documentId}, status: ${status}`);

      res.status(200).json({
        success: true,
        data: { 
          document: updatedDocument,
          message: `Document ${status.toLowerCase()} successfully`
        },
      });
    } catch (error) {
      logger.error('Review verification document error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to review document';
      const statusCode = message.includes('not found') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'DOCUMENT_NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get all pending verification documents (admin only)
   */
  getPendingVerificationDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const documents = await this.userRepository.getPendingVerificationDocuments();
      
      res.status(200).json({
        success: true,
        data: { documents },
      });
    } catch (error) {
      logger.error('Get pending verification documents error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get pending documents',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get admin dashboard statistics (admin only)
   */
  getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.userRepository.getDashboardStats();
      
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get dashboard statistics',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };
}