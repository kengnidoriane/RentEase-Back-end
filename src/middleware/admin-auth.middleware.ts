import { Request, Response, NextFunction } from 'express';
import { AdminService } from '@/services/admin.service';
import { authenticate, authorize } from '@/middleware/auth.middleware';

export class AdminAuthMiddleware {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  /**
   * Admin authentication with activity logging
   */
  authenticateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // First run standard authentication
    await new Promise<void>((resolve, reject) => {
      authenticate(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Then check admin authorization
    await new Promise<void>((resolve, reject) => {
      authorize(['ADMIN'])(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Log admin access
    if (req.user) {
      try {
        await this.adminService.logAdminActivity({
          adminId: req.user.id,
          action: 'ADMIN_LOGIN',
          targetType: 'USER',
          targetId: req.user.id,
          details: {
            endpoint: req.path,
            method: req.method,
          },
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
        });
      } catch (error) {
        // Don't fail the request if logging fails
        console.error('Failed to log admin activity:', error);
      }
    }

    next();
  };

  /**
   * Log admin action middleware
   */
  logAdminAction = (action: string, targetType: 'USER' | 'PROPERTY' | 'DOCUMENT') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Store original res.json to intercept successful responses
      const originalJson = res.json;
      
      res.json = function(body: any) {
        // Only log if the response was successful
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
          const targetId = req.params.userId || req.params.propertyId || req.params.documentId || 'unknown';
          
          // Don't await this to avoid blocking the response
          new AdminService().logAdminActivity({
            adminId: req.user.id,
            action: action as any,
            targetType,
            targetId,
            details: {
              endpoint: req.path,
              method: req.method,
              requestBody: req.body,
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
          }).catch(error => {
            console.error('Failed to log admin activity:', error);
          });
        }
        
        return originalJson.call(this, body);
      };

      next();
    };
  };
}

// Create singleton instance
const adminAuthMiddleware = new AdminAuthMiddleware();

export const authenticateAdmin = adminAuthMiddleware.authenticateAdmin;
export const logAdminAction = adminAuthMiddleware.logAdminAction;