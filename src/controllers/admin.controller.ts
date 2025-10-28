import { Request, Response } from 'express';
import { UserRepository } from '@/repositories/user.repository';
import { PropertyRepository } from '@/repositories/property.repository';
import { AdminService } from '@/services/admin.service';
import { AdminAuditService } from '@/services/admin-audit.service';
import { logger } from '@/utils/logger';
import { prisma } from '@/config/database';

export class AdminController {
  private userRepository: UserRepository;
  private propertyRepository: PropertyRepository;
  private adminService: AdminService;
  private auditService: AdminAuditService;

  constructor() {
    this.userRepository = new UserRepository();
    this.propertyRepository = new PropertyRepository(prisma);
    this.adminService = new AdminService();
    this.auditService = new AdminAuditService();
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
      const stats = await this.adminService.getDashboardStats();
      
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

  /**
   * Get all properties pending verification (admin only)
   */
  getPendingProperties = async (req: Request, res: Response): Promise<void> => {
    try {
      const properties = await this.propertyRepository.findPendingVerification();
      
      res.status(200).json({
        success: true,
        data: { properties },
      });
    } catch (error) {
      logger.error('Get pending properties error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get pending properties',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get property by ID for verification (admin only)
   */
  getPropertyById = async (req: Request, res: Response): Promise<void> => {
    try {
      const propertyId = req.params['propertyId'];
      if (!propertyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Property ID is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }
      
      const property = await this.propertyRepository.findById(propertyId, true);
      if (!property) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PROPERTY_NOT_FOUND',
            message: 'Property not found',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { property },
      });
    } catch (error) {
      logger.error('Get property by ID error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get property',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Approve property (admin only)
   */
  approveProperty = async (req: Request, res: Response): Promise<void> => {
    try {
      const propertyId = req.params['propertyId'];
      if (!propertyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Property ID is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin authentication required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      await this.adminService.approveProperty(adminId, propertyId);
      const updatedProperty = await this.propertyRepository.findById(propertyId, true);

      logger.info(`Property approved by admin: ${propertyId}`, { adminId });

      res.status(200).json({
        success: true,
        data: { 
          property: updatedProperty,
          message: 'Property approved successfully'
        },
      });
    } catch (error) {
      logger.error('Approve property error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to approve property';
      const statusCode = message.includes('not found') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'PROPERTY_NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Reject property (admin only)
   */
  rejectProperty = async (req: Request, res: Response): Promise<void> => {
    try {
      const propertyId = req.params['propertyId'];
      if (!propertyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Property ID is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const { rejectionReason } = req.body;
      if (!rejectionReason) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Rejection reason is required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Admin authentication required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      await this.adminService.rejectProperty(adminId, propertyId, rejectionReason);
      const updatedProperty = await this.propertyRepository.findById(propertyId, true);

      logger.info(`Property rejected by admin: ${propertyId}`, { adminId, rejectionReason });

      res.status(200).json({
        success: true,
        data: { 
          property: updatedProperty,
          message: 'Property rejected successfully'
        },
      });
    } catch (error) {
      logger.error('Reject property error:', error);
      
      const message = error instanceof Error ? error.message : 'Failed to reject property';
      const statusCode = message.includes('not found') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: statusCode === 404 ? 'PROPERTY_NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
          message,
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get admin activity logs (admin only)
   */
  getActivityLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 50;
      const adminId = req.query['adminId'] as string;
      const action = req.query['action'] as string;
      const targetType = req.query['targetType'] as string;
      const targetId = req.query['targetId'] as string;
      
      const startDate = req.query['startDate'] ? new Date(req.query['startDate'] as string) : undefined;
      const endDate = req.query['endDate'] ? new Date(req.query['endDate'] as string) : undefined;

      const options: any = {
        page,
        limit,
      };
      
      if (adminId) options.adminId = adminId;
      if (action) options.action = action;
      if (targetType) options.targetType = targetType;
      if (targetId) options.targetId = targetId;
      if (startDate) options.startDate = startDate;
      if (endDate) options.endDate = endDate;

      const result = await this.auditService.getActivityLogs(options);

      res.status(200).json({
        success: true,
        data: {
          logs: result.logs,
          summary: result.summary,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get activity logs error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get activity logs',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get activity summary for dashboard (admin only)
   */
  getActivitySummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const days = parseInt(req.query['days'] as string) || 30;
      const summary = await this.auditService.getActivitySummary(days);
      
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Get activity summary error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get activity summary',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };

  /**
   * Get audit trail for specific target (admin only)
   */
  getTargetAuditTrail = async (req: Request, res: Response): Promise<void> => {
    try {
      const { targetType, targetId } = req.params;
      const limit = parseInt(req.query['limit'] as string) || 100;

      if (!targetType || !targetId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Target type and ID are required',
            timestamp: new Date().toISOString(),
            path: req.path,
          },
        });
        return;
      }

      const auditTrail = await this.auditService.getTargetAuditTrail(targetType, targetId, limit);
      
      res.status(200).json({
        success: true,
        data: { auditTrail },
      });
    } catch (error) {
      logger.error('Get target audit trail error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get audit trail',
          timestamp: new Date().toISOString(),
          path: req.path,
        },
      });
    }
  };
}